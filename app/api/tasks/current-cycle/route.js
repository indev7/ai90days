import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { getOKRTsByOwner } from '../../../../lib/pgdb';

export async function GET() {
  try {
    console.log('=== /api/tasks/current-cycle endpoint called ===');
    
    const session = await getSession();
    if (!session?.sub) {
      console.log('No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.sub;
    console.log('Fetching tasks for user:', userId);

    // Get current quarter info to filter tasks for current cycle
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Calculate current quarter (assuming Q1 starts in January)
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentQuarter = Math.ceil(currentMonth / 3);
    
    // Format current quarter - support both "2025Q4" and "2025-Q4" formats
    const currentCycleQtr1 = `${currentYear}Q${currentQuarter}`;
    const currentCycleQtr2 = `${currentYear}-Q${currentQuarter}`;

    console.log('Current quarter:', currentQuarter);
    console.log('Looking for cycle_qtr:', currentCycleQtr1, 'or', currentCycleQtr2);

    // Get all OKRTs for the user
    const allOKRTs = await getOKRTsByOwner(userId);
    
    // Find objectives for current quarter
    const currentQuarterObjectives = allOKRTs.filter(okrt => 
      okrt.type === 'O' && 
      (okrt.cycle_qtr === currentCycleQtr1 || okrt.cycle_qtr === currentCycleQtr2)
    );
    
    console.log('Found objectives for current quarter:', currentQuarterObjectives.length);
    
    // Get all objective IDs for current quarter
    const objectiveIds = currentQuarterObjectives.map(obj => obj.id);
    
    // Find all tasks that belong to current quarter objectives (through KRs)
    const tasks = [];
    for (const objectiveId of objectiveIds) {
      // Find KRs under this objective
      const keyResults = allOKRTs.filter(okrt => 
        okrt.type === 'K' && okrt.parent_id === objectiveId
      );
      
      // Find tasks under these KRs with todo or in_progress status
      for (const kr of keyResults) {
        const krTasks = allOKRTs.filter(okrt => 
          okrt.type === 'T' && 
          okrt.parent_id === kr.id &&
          (okrt.task_status === 'todo' || okrt.task_status === 'in_progress')
        );
        tasks.push(...krTasks);
      }
    }

    console.log('Found tasks for current quarter objectives:', tasks.length);

    // Map tasks to include parent information for color coordination
    const tasksWithParentInfo = tasks.map(task => {
      // Find parent key result
      const parentKR = allOKRTs.find(okrt => okrt.id === task.parent_id && okrt.type === 'K');
      // Find grandparent objective
      const parentObjective = parentKR ? 
        allOKRTs.find(okrt => okrt.id === parentKR.parent_id && okrt.type === 'O') : 
        null;
      
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        task_status: task.task_status,
        progress: task.progress || 0,
        created_at: task.created_at,
        parent_id: task.parent_id,
        objective_id: parentObjective?.id || null,
        objective_title: parentObjective?.title || parentObjective?.description || null,
        kr_title: parentKR?.title || parentKR?.description || null
      };
    });

    console.log('Tasks with parent info:', tasksWithParentInfo.length);

    return NextResponse.json({
      tasks: tasksWithParentInfo,
      quarter: currentQuarter,
      year: currentYear
    });

  } catch (error) {
    console.error('Error fetching current cycle tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}