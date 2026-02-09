'use client';

import { useMemo } from 'react';
import ProgressRing from './OKRTCards/ProgressRing';
import styles from './ContextUsageIndicator.module.css';

/**
 * ContextUsageIndicator - Compact display of context usage and token cost
 * @param {number} inputTokens - Number of input tokens used
 * @param {number} outputTokens - Number of output tokens used
 * @param {number} maxTokens - Maximum context window size (default: 200000)
 * @param {string} provider - LLM provider (bedrock, anthropic, openai)
 */
export default function ContextUsageIndicator({
  inputTokens = 0,
  outputTokens = 0,
  maxTokens = 200000,
  provider = 'bedrock'
}) {
  const { percentage, color, formattedCost } = useMemo(() => {
    const totalTokens = inputTokens + outputTokens;
    const pct = Math.min(totalTokens / maxTokens, 1);
    
    // Color coding based on usage
    let ringColor;
    if (pct < 0.5) ringColor = 'var(--color-success, #10b981)';
    else if (pct < 0.75) ringColor = 'var(--color-warning, #f59e0b)';
    else ringColor = 'var(--color-danger, #ef4444)';
    
    // Pricing per 1M tokens
    const pricing = {
      bedrock: { input: 1.00, output: 5.00 },
      anthropic: { input: 3.00, output: 15.00 },
      openai: { input: 2.50, output: 10.00 }
    };
    
    const rates = pricing[provider] || pricing.bedrock;
    const inputCost = (inputTokens / 1_000_000) * rates.input;
    const outputCost = (outputTokens / 1_000_000) * rates.output;
    const totalCost = inputCost + outputCost;
    
    let formatted;
    if (totalCost < 0.001) formatted = '<$0.001';
    else if (totalCost < 0.01) formatted = `$${totalCost.toFixed(4)}`;
    else if (totalCost < 1) formatted = `$${totalCost.toFixed(3)}`;
    else formatted = `$${totalCost.toFixed(2)}`;
    
    return {
      percentage: pct,
      color: ringColor,
      formattedCost: formatted
    };
  }, [inputTokens, outputTokens, maxTokens, provider]);

  if (inputTokens === 0 && outputTokens === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.ringWrapper}
        title={`Context: ${inputTokens.toLocaleString()} in + ${outputTokens.toLocaleString()} out / ${maxTokens.toLocaleString()} max`}
      >
        <ProgressRing value={percentage} size={32} stroke={3} color={color} />
      </div>
      
      <div
        className={styles.costValue}
        title={`Cost: ${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output tokens`}
      >
        {formattedCost}
      </div>
    </div>
  );
}
