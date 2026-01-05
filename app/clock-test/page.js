'use client';

import { useState } from 'react';
import TodayClock from '../../components/TodayClock';
import TaskUpdateModal from '../../components/TaskUpdateModal';

// Demo tasks for testing
const demoTasks = [
  {
    id: 'demo-task-1',
    description: 'Complete project presentation',
    scheduledDateTime: new Date().toISOString().split('T')[0] + 'T09:00:00',
    duration: 60,
    isScheduled: true,
    progress: 25,
    task_status: 'in_progress',
    color: '#3b82f6',
    weight: 1.0
  },
  {
    id: 'demo-task-2', 
    description: 'Team meeting',
    scheduledDateTime: new Date().toISOString().split('T')[0] + 'T14:30:00',
    duration: 30,
    isScheduled: true,
    progress: 0,
    task_status: 'todo',
    color: '#10b981',
    weight: 1.0
  },
  {
    id: 'demo-task-3',
    description: 'Code review',
    scheduledDateTime: new Date().toISOString().split('T')[0] + 'T16:00:00', 
    duration: 45,
    isScheduled: true,
    progress: 100,
    task_status: 'done',
    color: '#f59e0b',
    weight: 1.0
  }
];

export default function ClockTestPage() {
  const [taskUpdateModalState, setTaskUpdateModalState] = useState({
    isOpen: false,
    task: null
  });

  const handleTaskClick = (task) => {
    console.log('Task clicked:', task);
    setTaskUpdateModalState({
      isOpen: true,
      task: task
    });
  };

  const handleCloseTaskUpdateModal = () => {
    setTaskUpdateModalState({
      isOpen: false,
      task: null
    });
  };

  const handleSaveTaskUpdate = async (taskId, updateData) => {
    try {
      console.log('Demo: Saving task update:', { taskId, updateData });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close modal
      handleCloseTaskUpdateModal();
      
      alert(`Task updated successfully!\nProgress: ${updateData.progress}%\nStatus: ${updateData.task_status}`);
      
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  return (
    <div className="app-page">
      <div className="app-pageContent">
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
            TodayClock + TaskUpdateModal Demo
          </h1>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '2rem' 
          }}>
            <div style={{
              padding: '2rem',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              backgroundColor: '#f9fafb'
            }}>
              <h2 style={{ textAlign: 'center', marginBottom: '1rem', color: '#374151' }}>
                Click on Task Sectors
              </h2>
              <TodayClock 
                todoTasks={demoTasks} 
                size={300} 
                onTaskClick={handleTaskClick}
              />
            </div>
            
            <div style={{ 
              maxWidth: '600px', 
              textAlign: 'center', 
              color: '#6b7280' 
            }}>
              <h3>Instructions:</h3>
              <ul style={{ textAlign: 'left', lineHeight: '1.6' }}>
                <li>The colored sectors on the clock face represent scheduled tasks</li>
                <li>Hover over sectors to see them highlight</li>
                <li>Click on any sector to open the task update modal</li>
                <li>Use the progress slider to update task completion (0-100%)</li>
                <li>Task status updates automatically based on progress:
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li><strong>0%</strong> = Todo</li>
                    <li><strong>1-99%</strong> = In Progress</li>
                    <li><strong>100%</strong> = Done</li>
                  </ul>
                </li>
              </ul>
            </div>
          </div>

          {/* Task Update Modal */}
          <TaskUpdateModal
            isOpen={taskUpdateModalState.isOpen}
            onClose={handleCloseTaskUpdateModal}
            task={taskUpdateModalState.task}
            onSave={handleSaveTaskUpdate}
          />
        </div>
      </div>
    </div>
  );
}
