/**
 * Progress propagation utility for OKRT hierarchy
 * Handles weighted progress calculation and propagation from Tasks -> KRs -> Objectives
 */

import { getDatabase } from './pgdb';

/**
 * Calculate weighted average progress for children
 * @param {Array} children - Array of child items with progress and weight properties
 * @returns {number} Weighted average progress (0-100)
 */
export function calculateWeightedProgress(children) {
  if (!children || children.length === 0) {
    return 0;
  }

  const totalWeight = children.reduce((sum, child) => sum + (child.weight || 1), 0);
  
  if (totalWeight === 0) {
    return 0;
  }

  const weightedSum = children.reduce((sum, child) => {
    const childProgress = child.progress || 0;
    const childWeight = child.weight || 1;
    return sum + (childProgress * childWeight);
  }, 0);

  return Math.round(weightedSum / totalWeight);
}

/**
 * Update parent KR progress based on its tasks
 * @param {string} krId - Key Result ID
 * @returns {Promise<number>} New KR progress value
 */
export async function updateKRProgress(krId) {
  const db = await getDatabase();
  
  try {
    // Get all tasks for this KR
    const tasks = await db.all(
      'SELECT progress, weight FROM okrt WHERE parent_id = ? AND type = "T"',
      [krId]
    );

    // Calculate new KR progress
    const newProgress = calculateWeightedProgress(tasks);

    // Update KR progress
    await db.run(
      'UPDATE okrt SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newProgress, krId]
    );

    console.log(`Updated KR ${krId} progress to ${newProgress}%`);
    return newProgress;
  } catch (error) {
    console.error('Error updating KR progress:', error);
    throw error;
  }
}

/**
 * Update parent Objective progress based on its KRs
 * @param {string} objectiveId - Objective ID
 * @returns {Promise<number>} New Objective progress value
 */
export async function updateObjectiveProgress(objectiveId) {
  const db = await getDatabase();
  
  try {
    // Get all KRs for this Objective
    const krs = await db.all(
      'SELECT progress, weight FROM okrt WHERE parent_id = ? AND type = "K"',
      [objectiveId]
    );

    // Calculate new Objective progress
    const newProgress = calculateWeightedProgress(krs);

    // Update Objective progress
    await db.run(
      'UPDATE okrt SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newProgress, objectiveId]
    );

    console.log(`Updated Objective ${objectiveId} progress to ${newProgress}%`);
    return newProgress;
  } catch (error) {
    console.error('Error updating Objective progress:', error);
    throw error;
  }
}

/**
 * Propagate task progress update through the hierarchy
 * @param {string} taskId - Task ID that was updated
 * @returns {Promise<{krProgress: number, objectiveProgress: number}>} Updated progress values
 */
export async function propagateTaskProgress(taskId) {
  const db = await getDatabase();
  
  try {
    // Get task and its parent hierarchy
    const task = await db.get('SELECT parent_id FROM okrt WHERE id = ? AND type = "T"', [taskId]);
    
    if (!task || !task.parent_id) {
      throw new Error('Task not found or has no parent KR');
    }

    const krId = task.parent_id;

    // Get KR and its parent Objective
    const kr = await db.get('SELECT parent_id FROM okrt WHERE id = ? AND type = "K"', [krId]);
    
    if (!kr || !kr.parent_id) {
      throw new Error('KR not found or has no parent Objective');
    }

    const objectiveId = kr.parent_id;

    // Update KR progress based on all its tasks
    const krProgress = await updateKRProgress(krId);

    // Update Objective progress based on all its KRs
    const objectiveProgress = await updateObjectiveProgress(objectiveId);

    console.log(`Progress propagation complete: Task ${taskId} -> KR ${krId} (${krProgress}%) -> Objective ${objectiveId} (${objectiveProgress}%)`);

    return {
      krProgress,
      objectiveProgress,
      krId,
      objectiveId
    };
  } catch (error) {
    console.error('Error propagating task progress:', error);
    throw error;
  }
}

/**
 * Propagate KR progress update to its parent Objective
 * @param {string} krId - KR ID that was updated
 * @returns {Promise<{objectiveProgress: number}>} Updated progress values
 */
export async function propagateKRProgress(krId) {
  const db = await getDatabase();
  
  try {
    // Get KR and its parent Objective
    const kr = await db.get('SELECT parent_id FROM okrt WHERE id = ? AND type = "K"', [krId]);
    
    if (!kr || !kr.parent_id) {
      throw new Error('KR not found or has no parent Objective');
    }

    const objectiveId = kr.parent_id;

    // Update Objective progress based on all its KRs
    const objectiveProgress = await updateObjectiveProgress(objectiveId);

    console.log(`KR progress propagation complete: KR ${krId} -> Objective ${objectiveId} (${objectiveProgress}%)`);

    return {
      objectiveProgress,
      objectiveId
    };
  } catch (error) {
    console.error('Error propagating KR progress:', error);
    throw error;
  }
}

/**
 * Update task and propagate progress through hierarchy
 * @param {string} taskId - Task ID to update
 * @param {Object} updateData - Update data including progress
 * @returns {Promise<Object>} Update result with propagated progress
 */
export async function updateTaskWithPropagation(taskId, updateData) {
  const db = await getDatabase();
  
  try {
    // Start a transaction
    const db = await getDatabase();
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

    // Update the task
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updateData[key]);
      }
    });
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(taskId);

    const convertedSql = `UPDATE okrt SET ${updateFields.join(', ')} WHERE id = $${updateValues.length}`.replace(/\?/g, (match, offset) => {
      let count = 0;
      for (let i = 0; i < offset; i++) {
        if (updateFields[i] && updateFields[i].includes('?')) count++;
      }
      return `$${count + 1}`;
    });
    
    await client.query(convertedSql, updateValues);

    // If progress was updated, propagate it
    let propagationResult = null;
    if (updateData.progress !== undefined) {
      propagationResult = await propagateTaskProgress(taskId);
    }

      // Commit the transaction
      await client.query('COMMIT');

      return {
        success: true,
        taskId,
        propagationResult
      };
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error('Error updating task with propagation:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in updateTaskWithPropagation:', error);
    throw error;
  }
}