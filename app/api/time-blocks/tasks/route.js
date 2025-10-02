import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { getOKRTsByOwner } from '../../../../lib/db';

// GET /api/time-blocks/tasks - Get tasks available for scheduling in hierarchical structure
export async function GET(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all OKRTs for the user
    const allOKRTs = await getOKRTsByOwner(session.sub);
    
    // Build hierarchical structure
    const objectives = allOKRTs.filter(okrt => okrt.type === 'O');
    const keyResults = allOKRTs.filter(okrt => okrt.type === 'K');
    const tasks = allOKRTs.filter(okrt => 
      okrt.type === 'T' && (okrt.task_status === 'todo' || okrt.task_status === 'in_progress')
    );

    // Build hierarchy
    const hierarchy = objectives.map(objective => {
      const objectiveKRs = keyResults.filter(kr => kr.parent_id === objective.id);
      
      return {
        id: objective.id,
        title: objective.title || objective.description || 'Untitled Objective',
        type: 'objective',
        keyResults: objectiveKRs.map(kr => {
          const krTasks = tasks.filter(task => task.parent_id === kr.id);
          
          return {
            id: kr.id,
            title: kr.title || kr.description || 'Untitled Key Result',
            type: 'keyResult',
            tasks: krTasks.map(task => ({
              id: task.id,
              title: task.title || task.description || 'Untitled Task',
              description: task.description,
              task_status: task.task_status,
              type: 'task'
            }))
          };
        }).filter(kr => kr.tasks.length > 0) // Only include KRs that have tasks
      };
    }).filter(obj => obj.keyResults.length > 0); // Only include objectives that have KRs with tasks

    // Also include orphaned key results (KRs without parent objectives)
    const orphanedKRs = keyResults.filter(kr => 
      !kr.parent_id || !objectives.find(obj => obj.id === kr.parent_id)
    );

    orphanedKRs.forEach(kr => {
      const krTasks = tasks.filter(task => task.parent_id === kr.id);
      if (krTasks.length > 0) {
        hierarchy.push({
          id: `orphaned-${kr.id}`,
          title: 'Other Key Results',
          type: 'objective',
          keyResults: [{
            id: kr.id,
            title: kr.title || kr.description || 'Untitled Key Result',
            type: 'keyResult',
            tasks: krTasks.map(task => ({
              id: task.id,
              title: task.title || task.description || 'Untitled Task',
              description: task.description,
              task_status: task.task_status,
              type: 'task'
            }))
          }]
        });
      }
    });

    // Also include orphaned tasks (tasks without parent KRs)
    const orphanedTasks = tasks.filter(task => 
      !task.parent_id || !keyResults.find(kr => kr.id === task.parent_id)
    );

    if (orphanedTasks.length > 0) {
      hierarchy.push({
        id: 'orphaned-tasks',
        title: 'Other Tasks',
        type: 'objective',
        keyResults: [{
          id: 'orphaned-tasks-kr',
          title: 'Standalone Tasks',
          type: 'keyResult',
          tasks: orphanedTasks.map(task => ({
            id: task.id,
            title: task.title || task.description || 'Untitled Task',
            description: task.description,
            task_status: task.task_status,
            type: 'task'
          }))
        }]
      });
    }

    return NextResponse.json({ hierarchy });
  } catch (error) {
    console.error('Error fetching available tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}