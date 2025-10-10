import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { getOKRTById } from '../../../../lib/db';
import { updateTaskWithPropagation } from '../../../../lib/progressPropagation';

// PUT /api/tasks/[id] - Update a task with progress propagation
export async function PUT(request, { params }) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const task = await getOKRTById(id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if it's actually a task
    if (task.type !== 'T') {
      return NextResponse.json({ error: 'Item is not a task' }, { status: 400 });
    }

    // Check if user owns the task
    if (task.owner_id.toString() !== session.sub.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData = await request.json();
    
    // Validate progress if provided
    if (updateData.progress !== undefined) {
      const progress = parseInt(updateData.progress);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 });
      }
      updateData.progress = progress;
    }

    // Validate task_status if provided
    if (updateData.task_status && !['todo', 'in_progress', 'done', 'blocked'].includes(updateData.task_status)) {
      return NextResponse.json({ 
        error: 'Invalid task_status. Must be: todo, in_progress, done, or blocked' 
      }, { status: 400 });
    }

    console.log('=== Updating Task with Propagation ===');
    console.log('Task ID:', id);
    console.log('Update Data:', updateData);
    console.log('=====================================');

    // Update task and propagate progress
    const result = await updateTaskWithPropagation(id, updateData);

    // Get the updated task for response
    const updatedTask = await getOKRTById(id);

    return NextResponse.json({
      success: true,
      task: updatedTask,
      propagation: result.propagationResult
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ 
      error: 'Failed to update task',
      details: error.message 
    }, { status: 500 });
  }
}