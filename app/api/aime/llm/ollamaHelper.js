/**
 * Ollama Helper for /api/aime route
 * 
 * Since Ollama doesn't support native function calling, we use inline JSON parsing.
 * The LLM is prompted to output actions in a specific format:
 * 
 * [coaching message]
 * 
 * ACTIONS_JSON:
 * {"actions":[...]}
 * 
 * This handler extracts and validates the actions from the text stream.
 */

export async function handleOllama({ 
  llmMessages, 
  logHumanReadable, 
  logLlmApiInteraction,
  extractActionsFromArgs,
  extractReqMoreInfoFromArgs
}) {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.LLM_MODEL_NAME || process.env.LLM_CHAT_MODEL || 'llama3:latest';
  
  // Configure Ollama with performance optimizations
  const ollamaPayload = { 
    model, 
    messages: llmMessages, 
    stream: true,
    keep_alive: '15m',
    options: {
      temperature: 0.1,
      top_p: 0.9,
      num_predict: 3000,
      num_ctx: 8192,
      num_thread: 8,
      repeat_penalty: 1.1,
    }
  };
  
  const requestBody = JSON.stringify(ollamaPayload);

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    await logLlmApiInteraction?.({
      provider: 'ollama',
      request: {
        url: `${ollamaUrl}/api/chat`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorBody
      },
      error: `Ollama API error: ${response.status}`
    });
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      let accumText = '';
      let actionsSent = false;
      let reqMoreInfoSent = false;
      let rawResponse = '';
      let hasLoggedRawResponse = false;
      
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      
      const logRawResponse = () => {
        if (hasLoggedRawResponse) return;
        void logLlmApiInteraction?.({
          provider: 'ollama',
          request: {
            url: `${ollamaUrl}/api/chat`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: rawResponse
          }
        });
        hasLoggedRawResponse = true;
      };

      /**
       * Validates JSON structure comprehensively
       */
      const validateJsonStructure = (text) => {
        const validation = {
          isValid: true,
          errors: [],
          braceCount: 0,
          bracketCount: 0,
          isComplete: false
        };

        let braceDepth = 0;
        let bracketDepth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }

          if (char === '\\' && inString) {
            escapeNext = true;
            continue;
          }

          if (inString) continue;

          switch (char) {
            case '{':
              braceDepth++;
              validation.braceCount++;
              break;
            case '}':
              braceDepth--;
              if (braceDepth < 0) {
                validation.isValid = false;
                validation.errors.push(`Unmatched closing brace at position ${i}`);
              }
              break;
            case '[':
              bracketDepth++;
              validation.bracketCount++;
              break;
            case ']':
              bracketDepth--;
              if (bracketDepth < 0) {
                validation.isValid = false;
                validation.errors.push(`Unmatched closing bracket at position ${i}`);
              }
              break;
          }
        }

        if (braceDepth > 0) {
          validation.isValid = false;
          validation.errors.push(`${braceDepth} unclosed brace(s)`);
        }

        if (bracketDepth > 0) {
          validation.isValid = false;
          validation.errors.push(`${bracketDepth} unclosed bracket(s)`);
        }

        validation.isComplete = braceDepth === 0 && bracketDepth === 0;

        return validation;
      };

      /**
       * Converts incorrect nested format to flat actions array
       * Legacy format: {objective: {...}, kr: {...}, task: {...}}
       * Correct format: {actions: [{intent, endpoint, method, payload}, ...]}
       */
      const convertNestedToActions = (obj) => {
        const actions = [];
        const currentQuarter = (() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const quarter = Math.ceil(month / 3);
          return `${year}-Q${quarter}`;
        })();

        // Handle objective
        if (obj.objective) {
          const o = obj.objective;
          actions.push({
            intent: 'CREATE_OKRT',
            endpoint: '/api/okrt',
            method: 'POST',
            payload: {
              id: o.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
              type: 'O',
              title: o.title || o.description || 'Untitled Objective',
              description: o.description || o.title || '',
              area: o.area || 'Work',
              status: o.status === 'Draft' ? 'D' : (o.status === 'Active' ? 'A' : (o.status === 'Complete' ? 'C' : 'D')),
              visibility: (o.visibility || 'private').toLowerCase(),
              objective_kind: (o.objective_kind || 'committed').toLowerCase(),
              cycle_qtr: o.cycle_qtr || currentQuarter,
              progress: typeof o.progress === 'number' ? o.progress : 0
            }
          });
        }

        // Handle key result
        if (obj.kr) {
          const kr = obj.kr;
          const parentId = obj.objective?.id || kr.parent_id;
          const krTargetNumber = kr.kr_target_number !== undefined ? parseFloat(kr.kr_target_number) : 100;
          const krUnit = kr.kr_unit || 'count';

          actions.push({
            intent: 'CREATE_OKRT',
            endpoint: '/api/okrt',
            method: 'POST',
            payload: {
              id: kr.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
              type: 'K',
              parent_id: parentId,
              description: kr.description || kr.title || 'Untitled Key Result',
              kr_target_number: krTargetNumber,
              kr_unit: krUnit,
              kr_baseline_number: kr.kr_baseline_number !== undefined ? parseFloat(kr.kr_baseline_number) : 0,
              weight: kr.weight !== undefined ? parseFloat(kr.weight) : 1.0,
              progress: typeof kr.progress === 'number' ? kr.progress : 0
            }
          });
        }

        // Handle task
        if (obj.task) {
          const t = obj.task;
          const parentId = obj.kr?.id || t.parent_id;
          let taskStatus = (t.task_status || t.status || 'todo').toLowerCase().replace(/\s+/g, '_');
          if (!['todo', 'in_progress', 'done', 'blocked'].includes(taskStatus)) {
            taskStatus = 'todo';
          }

          actions.push({
            intent: 'CREATE_OKRT',
            endpoint: '/api/okrt',
            method: 'POST',
            payload: {
              id: t.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
              type: 'T',
              parent_id: parentId,
              description: t.description || t.title || 'Untitled Task',
              task_status: taskStatus,
              progress: typeof t.progress === 'number' ? t.progress : 0,
              weight: t.weight !== undefined ? parseFloat(t.weight) : 1.0,
              due_date: t.due_date || null
            }
          });
        }

        return actions.length > 0 ? actions : null;
      };

      /**
       * Attempts to extract actions or req_more_info from accumulated text
       * Handles multiple formats and validates JSON structure
       */
      const tryExtractData = (raw) => {
        if (!raw) return { actions: null, reqMoreInfo: null };

        console.log('\n🔍 OLLAMA EXTRACTION DEBUG:');
        console.log('Raw text length:', raw.length);
        console.log('Contains ACTIONS_JSON:', raw.includes('ACTIONS_JSON:'));
        console.log('Contains REQ_MORE_INFO:', raw.includes('REQ_MORE_INFO:'));

        let extractedActions = null;
        let extractedReqMoreInfo = null;

        // Priority 1: Look for REQ_MORE_INFO marker (for knowledge-on-demand)
        const reqMoreInfoMarkerIndex = raw.indexOf('REQ_MORE_INFO:');
        if (reqMoreInfoMarkerIndex !== -1 && extractReqMoreInfoFromArgs) {
          console.log('✓ Found REQ_MORE_INFO marker at position', reqMoreInfoMarkerIndex);
          let after = raw.slice(reqMoreInfoMarkerIndex + 'REQ_MORE_INFO:'.length).trim();
          after = after.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
          
          const braceStart = after.indexOf('{');
          if (braceStart !== -1) {
            let depth = 0;
            let jsonEnd = -1;
            let inString = false;
            let escapeNext = false;

            for (let i = braceStart; i < after.length; i++) {
              const ch = after[i];
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              if (ch === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }
              if (ch === '\\' && inString) {
                escapeNext = true;
                continue;
              }
              if (inString) continue;

              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }

            if (jsonEnd !== -1) {
              const candidate = after.slice(braceStart, jsonEnd + 1).trim();
              const structureValidation = validateJsonStructure(candidate);
              
              if (structureValidation.isValid && structureValidation.isComplete) {
                try {
                  const parsed = JSON.parse(candidate);
                  const info = extractReqMoreInfoFromArgs(parsed);
                  if (info && !info.__invalid) {
                    console.log('✅ Extracted req_more_info:', info);
                    extractedReqMoreInfo = info;
                  }
                } catch (e) {
                  console.error('❌ Failed to parse REQ_MORE_INFO:', e.message);
                }
              }
            }
          }
        }

        // Priority 2: Look for ACTIONS_JSON marker
        const markerIndex = raw.indexOf('ACTIONS_JSON:');
        if (markerIndex !== -1) {
          console.log('✓ Found ACTIONS_JSON marker at position', markerIndex);
          let after = raw.slice(markerIndex + 'ACTIONS_JSON:'.length).trim();
          after = after.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
          
          const braceStart = after.indexOf('{');
          if (braceStart !== -1) {
            let depth = 0;
            let jsonEnd = -1;
            let inString = false;
            let escapeNext = false;

            for (let i = braceStart; i < after.length; i++) {
              const ch = after[i];
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              if (ch === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }
              if (ch === '\\' && inString) {
                escapeNext = true;
                continue;
              }
              if (inString) continue;

              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }

            if (jsonEnd !== -1) {
              const candidate = after.slice(braceStart, jsonEnd + 1).trim();
              const structureValidation = validateJsonStructure(candidate);
              
              if (structureValidation.isValid && structureValidation.isComplete) {
                try {
                  const parsed = JSON.parse(candidate);
                  if (parsed && Array.isArray(parsed.actions)) {
                    const validActions = parsed.actions.filter(a => a.intent && a.endpoint && a.method && a.payload);
                    if (validActions.length > 0) {
                      console.log('✅ Extracted', validActions.length, 'action(s) from ACTIONS_JSON');
                      extractedActions = validActions;
                    }
                  } else if (parsed && (parsed.objective || parsed.kr || parsed.task)) {
                    console.log('⚠️  Found nested format, converting...');
                    const converted = convertNestedToActions(parsed);
                    if (converted) extractedActions = converted;
                  }
                } catch (e) {
                  console.error('❌ Failed to parse ACTIONS_JSON:', e.message);
                }
              } else {
                console.log('⚠️  Attempting to fix incomplete JSON...');
                const fixedCandidate = after.slice(braceStart).trim() + '}';
                const fixedValidation = validateJsonStructure(fixedCandidate);
                
                if (fixedValidation.isValid && fixedValidation.isComplete) {
                  try {
                    const parsed = JSON.parse(fixedCandidate);
                    if (parsed && Array.isArray(parsed.actions)) {
                      const validActions = parsed.actions.filter(a => a.intent && a.endpoint && a.method && a.payload);
                      if (validActions.length > 0) {
                        console.log('✅ Extracted', validActions.length, 'action(s) from fixed JSON');
                        extractedActions = validActions;
                      }
                    }
                  } catch (e) {
                    console.error('❌ Failed to parse fixed JSON:', e.message);
                  }
                }
              }
            }
          }
        }

        // Fallback: Search for actions array format anywhere
        if (!extractedActions && raw.indexOf('"actions"') !== -1) {
          console.log('🔍 FALLBACK: Searching for actions array...');
          const idx = raw.lastIndexOf('"actions"');
          let start = idx;
          while (start > 0 && raw[start] !== '{') start--;
          
          if (raw[start] === '{') {
            let depth = 0;
            let inString = false;
            let escapeNext = false;

            for (let i = start; i < raw.length; i++) {
              const ch = raw[i];
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              if (ch === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }
              if (ch === '\\' && inString) {
                escapeNext = true;
                continue;
              }
              if (inString) continue;

              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) {
                  const candidate = raw.slice(start, i + 1).trim();
                  const structureValidation = validateJsonStructure(candidate);
                  
                  if (structureValidation.isValid && structureValidation.isComplete) {
                    try {
                      const parsed = JSON.parse(candidate);
                      if (parsed && Array.isArray(parsed.actions)) {
                        console.log('✅ Found actions via fallback search');
                        extractedActions = parsed.actions;
                      }
                    } catch (e) {
                      console.log('❌ Fallback parse failed:', e.message);
                    }
                  }
                  break;
                }
              }
            }
          }
        }

        // Post-process actions: regenerate duplicate/example IDs, fix endpoints
        if (extractedActions && extractedActions.length > 0) {
          const exampleIds = [
            'gen-a1b2c3d4', 'gen-e5f6g7h8', 'gen-i9j0k1l2',
            'gen-x7m9k2p4', 'gen-w3n8q5r1', 'gen-t6y2h9v3',
            'gen-abc12345', 'gen-u3v4w5x6', 'gen-j4k8m1n7', 'gen-p9r2s5t8'
          ];
          const usedIds = new Set();

          extractedActions = extractedActions.map(action => {
            // Regenerate IDs only for CREATE actions
            if (action.intent === 'CREATE_OKRT' && action.payload && action.payload.id) {
              const originalId = action.payload.id;
              if (exampleIds.includes(originalId) || usedIds.has(originalId)) {
                const newId = `gen-${Math.random().toString(36).substring(2, 10)}`;
                console.log(`⚠️  Replaced duplicate/example ID ${originalId} → ${newId}`);
                action.payload.id = newId;

                // Update parent_id references
                extractedActions.forEach(a => {
                  if (a.payload && a.payload.parent_id === originalId) {
                    a.payload.parent_id = newId;
                  }
                });
              }
              usedIds.add(action.payload.id);
            }

            // Fix endpoint for UPDATE/DELETE if missing ID
            if ((action.intent === 'UPDATE_OKRT' || action.intent === 'DELETE_OKRT') && 
                action.payload?.id && action.endpoint === '/api/okrt') {
              action.endpoint = `/api/okrt/${action.payload.id}`;
              console.log(`🔧 Corrected endpoint for ${action.intent}: ${action.endpoint}`);
            }

            if ((action.intent === 'UPDATE_JIRA' || action.intent === 'DELETE_JIRA') && 
                action.payload?.key && action.endpoint === '/api/jira/tickets') {
              action.endpoint = `/api/jira/tickets/${action.payload.key}`;
              console.log(`🔧 Corrected endpoint for ${action.intent}: ${action.endpoint}`);
            }

            return action;
          });
        }

        return { actions: extractedActions, reqMoreInfo: extractedReqMoreInfo };
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Final attempt at extraction
            if (!actionsSent && !reqMoreInfoSent) {
              const { actions, reqMoreInfo } = tryExtractData(accumText);
              
              if (reqMoreInfo && !reqMoreInfoSent) {
                console.log('✅ Sending req_more_info');
                send({ type: 'req_more_info', data: reqMoreInfo });
                reqMoreInfoSent = true;
              }
              
              if (actions && actions.length > 0 && !actionsSent) {
                console.log('✅ Sending', actions.length, 'action(s)');
                send({ type: 'actions', data: actions });
                actionsSent = true;
              }
            }
            
            logRawResponse();
            send({ type: 'done' });
            controller.close();
            break;
          }
          
          const chunk = new TextDecoder().decode(value);
          rawResponse += chunk;
          const lines = chunk.split('\n').filter(l => l.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                const content = data.message.content;
                accumText += content;
                send({ type: 'content', data: content });
                
                // Try extraction during streaming (for early detection)
                if (!actionsSent && !reqMoreInfoSent) {
                  const { actions, reqMoreInfo } = tryExtractData(accumText);
                  
                  if (reqMoreInfo && !reqMoreInfoSent) {
                    console.log('✅ Sending req_more_info (streaming)');
                    send({ type: 'req_more_info', data: reqMoreInfo });
                    reqMoreInfoSent = true;
                  }
                  
                  if (actions && actions.length > 0 && !actionsSent) {
                    console.log('✅ Sending', actions.length, 'action(s) (streaming)');
                    send({ type: 'actions', data: actions });
                    actionsSent = true;
                  }
                }
              }
              
              if (data.done) {
                logRawResponse();
                send({ type: 'done' });
              }
            } catch (e) {
              console.error('Ollama chunk parse error:', e);
            }
          }
        }
      } catch (err) {
        console.error('Ollama streaming error:', err);
        controller.error(err);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
