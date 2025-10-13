'use client';

import { useState, useEffect, useCallback } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import styles from './page.module.css';
import { createObjectiveColorMap, getThemeColorPalette, transformOKRTsToObjectives } from '../../lib/clockUtils';
import TaskUpdateModal from '../../components/TaskUpdateModal';

const DURATION_OPTIONS = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1h' },
    { value: 90, label: '1h 30min' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 300, label: '5h' },
    { value: 360, label: '6h' },
    { value: 480, label: '8h' },
    { value: 720, label: '12 hours' },
    { value: 1440, label: 'All day' }
];

// Generate time slots from 4AM to 11PM
const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 4; hour <= 23; hour++) {
        slots.push({
            hour,
            display: hour === 12 ? '12:00 PM' :
                hour === 0 ? '12:00 AM' :
                    hour < 12 ? `${hour}:00 AM` :
                        `${hour - 12}:00 PM`
        });
    }
    return slots;
};

const getDaysOfWeek = (currentDate) => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        days.push({
            date: new Date(date),
            name: date.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNumber: date.getDate()
        });
    }
    return days;
};

const formatTimeSlotId = (dayIndex, hour) => `${dayIndex}-${hour}`;

export default function CalendarPage() {
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
        const monday = new Date(today);
        monday.setDate(diff);
        return monday.toISOString().split('T')[0]; // Store as string
    });
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [timeBlockToDelete, setTimeBlockToDelete] = useState(null);
    const [showTaskUpdateModal, setShowTaskUpdateModal] = useState(false);
    const [selectedTimeBlock, setSelectedTimeBlock] = useState(null);
    const [timeBlocks, setTimeBlocks] = useState([]);
    const [taskHierarchy, setTaskHierarchy] = useState([]);
    const [selectedTask, setSelectedTask] = useState('');
    const [selectedTaskTitle, setSelectedTaskTitle] = useState('');
    const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
    const [selectedDuration, setSelectedDuration] = useState(30);
    const [startHour, setStartHour] = useState(9); // Default to 9 AM
    const [startMinute, setStartMinute] = useState(0); // Default to 00 minutes
    const [loading, setLoading] = useState(false);
    const [mobileCurrentDay, setMobileCurrentDay] = useState(0); // Index for mobile view
    const [objectiveColorMap, setObjectiveColorMap] = useState({});
    const [hoveredBlockId, setHoveredBlockId] = useState(null);

    const timeSlots = generateTimeSlots();
    const currentDate = new Date(currentWeekStart);
    const daysOfWeek = getDaysOfWeek(currentDate);

    // Determine which day is today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayIndex = daysOfWeek.findIndex(day =>
        day.date.toISOString().split('T')[0] === todayStr
    );

    // Fetch time blocks for the current week
    const fetchTimeBlocks = useCallback(async () => {
        try {
            const weekStart = new Date(currentWeekStart);
            const currentDays = getDaysOfWeek(weekStart);

            // Fetch time blocks for each day of the week
            const promises = currentDays.map(day => {
                const dateStr = day.date.toISOString().split('T')[0];
                return fetch(`/api/time-blocks?date=${dateStr}`)
                    .then(res => res.json())
                    .then(data => ({ date: dateStr, blocks: data.timeBlocks || [] }));
            });

            const results = await Promise.all(promises);
            const allBlocks = results.flatMap(result =>
                result.blocks.map(block => ({
                    ...block,
                    date: result.date
                }))
            );

            setTimeBlocks(allBlocks);
        } catch (error) {
            console.error('Error fetching time blocks:', error);
        }
    }, [currentWeekStart]);

    // Fetch available tasks hierarchy for scheduling - only fetch once on mount
    useEffect(() => {
        const fetchTaskHierarchy = async () => {
            try {
                // Use the same API as dashboard for consistency
                const response = await fetch('/api/okrt');
                if (response.ok) {
                    const data = await response.json();
                    const okrts = data.okrts || [];

                    // Filter to current quarter first (same logic as dashboard)
                    const currentDate = new Date();
                    const currentYear = currentDate.getFullYear();
                    const currentMonth = currentDate.getMonth() + 1;
                    const currentQuarter = Math.ceil(currentMonth / 3);
                    const currentCycleQtr1 = `${currentYear}Q${currentQuarter}`;
                    const currentCycleQtr2 = `${currentYear}-Q${currentQuarter}`;

                    console.log('Calendar filtering objectives for current quarter:', currentCycleQtr1, 'or', currentCycleQtr2);

                    const currentQuarterObjectives = okrts.filter(okrt =>
                        okrt.type === 'O' &&
                        (okrt.cycle_qtr === currentCycleQtr1 || okrt.cycle_qtr === currentCycleQtr2)
                    );

                    const objectiveIds = currentQuarterObjectives.map(obj => obj.id);
                    console.log('Calendar current quarter objective IDs:', objectiveIds);

                    // Include objectives and all their children (KRs and Tasks) - same as dashboard
                    const filteredOKRTs = okrts.filter(okrt => {
                        if (okrt.type === 'O') {
                            // Only include objectives from current quarter
                            return okrt.cycle_qtr === currentCycleQtr1 || okrt.cycle_qtr === currentCycleQtr2;
                        } else {
                            // For KRs and Tasks, include if they belong to current quarter objectives
                            return objectiveIds.includes(okrt.parent_id) ||
                                okrts.some(parent =>
                                    parent.id === okrt.parent_id &&
                                    objectiveIds.includes(parent.parent_id)
                                );
                        }
                    });

                    console.log('Calendar filtered OKRTs for current quarter:', filteredOKRTs.length, 'out of', okrts.length);

                    // Transform filtered OKRTs to objectives (same as dashboard)
                    const transformedObjectives = transformOKRTsToObjectives(filteredOKRTs, getThemeColorPalette());
                    console.log('Calendar transformed objectives:', transformedObjectives.map((obj, index) => ({
                        id: obj.id,
                        title: obj.title,
                        created_at: obj.created_at,
                        index: index,
                        color: obj.color
                    })));

                    const keyResults = filteredOKRTs.filter(okrt => okrt.type === 'K');
                    const tasks = filteredOKRTs.filter(okrt =>
                        okrt.type === 'T' && (okrt.task_status === 'todo' || okrt.task_status === 'in_progress')
                    );

                    // Build hierarchy with same sorting as transformOKRTsToObjectives
                    const hierarchy = currentQuarterObjectives
                        .sort((a, b) => {
                            const dateA = new Date(a.created_at || 0);
                            const dateB = new Date(b.created_at || 0);
                            return dateA - dateB;
                        })
                        .map(objective => {
                            const objectiveKRs = keyResults.filter(kr => kr.parent_id === objective.id);

                            return {
                                id: objective.id,
                                title: objective.title || objective.description || 'Untitled Objective',
                                type: 'objective',
                                created_at: objective.created_at,
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
                                }).filter(kr => kr.tasks.length > 0)
                            };
                        }).filter(obj => obj.keyResults.length > 0);

                    setTaskHierarchy(hierarchy);

                    // Create objective color map using same logic as dashboard
                    const colorMap = createObjectiveColorMap(transformedObjectives);
                    setObjectiveColorMap(colorMap);
                }
            } catch (error) {
                console.error('Error fetching task hierarchy:', error);
            }
        };

        fetchTaskHierarchy();
    }, []);

    useEffect(() => {
        fetchTimeBlocks();
    }, [fetchTimeBlocks]);

    const handleTimeSlotClick = (dayIndex, hour) => {
        const slotId = formatTimeSlotId(dayIndex, hour);
        if (selectedTimeSlot === slotId) {
            setSelectedTimeSlot(null);
        } else {
            setSelectedTimeSlot(slotId);
        }
    };

    const handleTimeSlotDoubleClick = (dayIndex, hour) => {
        const slotId = formatTimeSlotId(dayIndex, hour);
        setSelectedTimeSlot(slotId);
        setStartHour(hour); // Pre-select the clicked hour
        setStartMinute(0); // Reset minutes to 00
        setShowScheduleModal(true);
    };

    const handleSchedule = async () => {
        if (!selectedTask || !selectedTimeSlot) return;

        const [dayIndex] = selectedTimeSlot.split('-').map(Number);
        const selectedDay = daysOfWeek[dayIndex];
        const startTime = new Date(selectedDay.date);
        startTime.setHours(startHour, startMinute, 0, 0);

        // Check if the selected time is in the past
        const now = new Date();
        if (startTime < now) {
            alert('Cannot schedule tasks in the past. Please select a future time.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/time-blocks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_id: selectedTask,
                    start_time: startTime.toISOString(),
                    duration: selectedDuration,
                    objective_id: selectedObjectiveId
                })
            });

            if (response.ok) {
                resetModal();
                await fetchTimeBlocks(); // Refresh time blocks
            } else {
                console.error('Error creating time block');
            }
        } catch (error) {
            console.error('Error scheduling task:', error);
        } finally {
            setLoading(false);
        }
    };

    const navigateWeek = (direction) => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (direction * 7));
        setCurrentWeekStart(newDate.toISOString().split('T')[0]);
    };

    const navigateMobileDay = (direction) => {
        const newIndex = mobileCurrentDay + direction;
        if (newIndex >= 0 && newIndex < 7) {
            setMobileCurrentDay(newIndex);
        }
    };

    // Get color for a time block based on its objective
    const getTimeBlockColor = (block) => {
        console.log('Getting color for time block:', block);
        console.log('Available objective color map:', objectiveColorMap);

        // First try to use the objective mapping
        if (block.objective_id && objectiveColorMap[block.objective_id]) {
            const color = objectiveColorMap[block.objective_id].color;
            console.log(`Using objective color ${color} for objective_id ${block.objective_id}`);
            return color;
        }

        // Fallback: Use task_id to assign colors from the same palette used in 90Day Clock
        const colors = getThemeColorPalette();
        const colorIndex = (block.task_id || 0) % colors.length;
        const fallbackColor = colors[colorIndex];
        console.log(`Using fallback color ${fallbackColor} for task_id ${block.task_id} (no objective_id: ${block.objective_id})`);
        return fallbackColor;
    };

    const getTimeBlocksForSlot = (dayIndex, hour) => {
        const selectedDay = daysOfWeek[dayIndex];
        const dateStr = selectedDay.date.toISOString().split('T')[0];

        return timeBlocks.filter(block => {
            const blockStart = new Date(block.start_time);
            const blockHour = blockStart.getHours();
            return block.date === dateStr && blockHour === hour;
        });
    };

    const formatDuration = (minutes) => {
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
        return `${minutes}m`;
    };

    const formatTime = (hour, minute) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const minuteStr = minute.toString().padStart(2, '0');
        return `${displayHour}:${minuteStr} ${period}`;
    };

    const handleTaskSelect = (taskId, taskTitle, objectiveId) => {
        setSelectedTask(taskId);
        setSelectedTaskTitle(taskTitle);
        setSelectedObjectiveId(objectiveId);
    };

    const resetModal = () => {
        setShowScheduleModal(false);
        setSelectedTimeSlot(null);
        setSelectedTask('');
        setSelectedTaskTitle('');
        setSelectedObjectiveId('');
        setSelectedDuration(30);
        setStartHour(9);
        setStartMinute(0);
    };

    const handleDeleteTimeBlock = async () => {
        if (!timeBlockToDelete) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/time-blocks/${timeBlockToDelete}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setShowDeleteModal(false);
                setTimeBlockToDelete(null);
                await fetchTimeBlocks(); // Refresh time blocks
            } else {
                console.error('Error deleting time block');
                alert('Failed to delete time block');
            }
        } catch (error) {
            console.error('Error deleting time block:', error);
            alert('Failed to delete time block');
        } finally {
            setLoading(false);
        }
    };

    const openDeleteModal = (blockId, e) => {
        e.stopPropagation();
        setTimeBlockToDelete(blockId);
        setShowDeleteModal(true);
    };

    const closeDeleteModal = () => {
        setShowDeleteModal(false);
        setTimeBlockToDelete(null);
    };

    const handleTimeBlockClick = (block, e) => {
        e.stopPropagation();
        setSelectedTimeBlock({
            id: block.task_id,
            taskDescription: block.task_title || block.task_description || `Task ${block.task_id}`,
            progress: block.progress || 0,
            timeBlockId: block.id
        });
        setShowTaskUpdateModal(true);
    };

    const handleTaskUpdate = async (taskId, updateData) => {
        try {
            const response = await fetch(`/api/okrt/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                // Refresh time blocks to show updated progress
                await fetchTimeBlocks();
            } else {
                throw new Error('Failed to update task');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    };

    const closeTaskUpdateModal = () => {
        setShowTaskUpdateModal(false);
        setSelectedTimeBlock(null);
    };

    const handleDeleteFromModal = (timeBlockId) => {
        // Close the task update modal first
        setShowTaskUpdateModal(false);
        setSelectedTimeBlock(null);
        
        // Open the delete confirmation modal
        setTimeBlockToDelete(timeBlockId);
        setShowDeleteModal(true);
    };

    return (
        <div className={styles.calendarContainer}>
            <div className={styles.calendarHeader}>
                <h1 className={styles.calendarTitle}>Calendar</h1>
                <div className={styles.navigationControls}>
                    <button
                        className={styles.navButtonChevron}
                        onClick={() => navigateWeek(-1)}
                        aria-label="Previous Week"
                    >
                        <IoChevronBack size={20} />
                    </button>
                    <button
                        className={styles.navButtonToday}
                        onClick={() => {
                            const today = new Date();
                            const day = today.getDay();
                            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                            const monday = new Date(today);
                            monday.setDate(diff);
                            setCurrentWeekStart(monday.toISOString().split('T')[0]);
                        }}
                    >
                        Today
                    </button>
                    <button
                        className={styles.navButtonChevron}
                        onClick={() => navigateWeek(1)}
                        aria-label="Next Week"
                    >
                        <IoChevronForward size={20} />
                    </button>
                </div>
            </div>

            <div className={styles.calendarContent}>
                {/* Desktop Calendar Grid */}
                <div className={styles.calendarGrid}>
                    <div className={styles.timeColumn}>
                        <div className={styles.dayHeader}></div>
                        {timeSlots.map((slot) => (
                            <div key={slot.hour} className={styles.timeSlot}>
                                {slot.display}
                            </div>
                        ))}
                    </div>

                    {daysOfWeek.map((day, dayIndex) => (
                        <div key={dayIndex} className={`${styles.dayColumn} ${dayIndex === todayIndex ? styles.todayColumn : ''}`}>
                            <div className={styles.dayHeader}>
                                <div className={styles.dayName}>{day.name}</div>
                                <div className={styles.dayDate}>{day.dayNumber}</div>
                            </div>

                            {timeSlots.map((slot) => {
                                const slotId = formatTimeSlotId(dayIndex, slot.hour);
                                const isSelected = selectedTimeSlot === slotId;
                                const blocksInSlot = getTimeBlocksForSlot(dayIndex, slot.hour);

                                return (
                                    <div
                                        key={slot.hour}
                                        className={`${styles.timeSlotCell} ${isSelected ? styles.selected : ''}`}
                                        onClick={() => handleTimeSlotClick(dayIndex, slot.hour)}
                                        onDoubleClick={() => handleTimeSlotDoubleClick(dayIndex, slot.hour)}
                                    >
                                        {isSelected && (
                                            <button
                                                className={styles.scheduleButton}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setStartHour(slot.hour); // Set start hour based on selected slot
                                                    setStartMinute(0); // Reset minutes to 00
                                                    setShowScheduleModal(true);
                                                }}
                                            >
                                                Schedule
                                            </button>
                                        )}

                                        {blocksInSlot.map((block) => {
                                            // Calculate height based on duration (60px per hour)
                                            const heightPercentage = (block.duration / 60) * 100;
                                            const blockHeight = `${heightPercentage}%`;
                                            
                                            // Calculate top offset based on minutes past the hour
                                            const blockStart = new Date(block.start_time);
                                            const minutes = blockStart.getMinutes();
                                            const topOffset = `${(minutes / 60) * 100}%`;
                                            
                                            return (
                                                <div
                                                    key={block.id}
                                                    className={styles.timeBlock}
                                                    style={{
                                                        backgroundColor: getTimeBlockColor(block),
                                                        height: blockHeight,
                                                        top: topOffset,
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={() => setHoveredBlockId(block.id)}
                                                    onMouseLeave={() => setHoveredBlockId(null)}
                                                    onClick={(e) => handleTimeBlockClick(block, e)}
                                                >
                                                    <div className={styles.timeBlockTitle}>
                                                        {block.task_title || block.task_description || `Task ${block.task_id}`}
                                                    </div>
                                                    {hoveredBlockId === block.id && (
                                                    <button
                                                        className={styles.deleteButton}
                                                        onClick={(e) => openDeleteModal(block.id, e)}
                                                        aria-label="Delete time block"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <circle cx="8" cy="8" r="7" fill="white" stroke="currentColor" strokeWidth="1"/>
                                                            <path d="M5 5L11 11M11 5L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                                        </svg>
                                                    </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Mobile Calendar View */}
                <div className={styles.mobileCalendar}>
                    <div className={styles.mobileDayView}>
                        <div className={styles.mobileDayHeader}>
                            <button
                                className={styles.navButton}
                                onClick={() => navigateMobileDay(-1)}
                                disabled={mobileCurrentDay === 0}
                            >
                                ←
                            </button>
                            <div className={styles.mobileDayTitle}>
                                {daysOfWeek[mobileCurrentDay].name}, {daysOfWeek[mobileCurrentDay].dayNumber}
                            </div>
                            <button
                                className={styles.navButton}
                                onClick={() => navigateMobileDay(1)}
                                disabled={mobileCurrentDay === 6}
                            >
                                →
                            </button>
                        </div>

                        <div className={styles.mobileTimeSlots}>
                            {timeSlots.map((slot) => {
                                const slotId = formatTimeSlotId(mobileCurrentDay, slot.hour);
                                const isSelected = selectedTimeSlot === slotId;
                                const blocksInSlot = getTimeBlocksForSlot(mobileCurrentDay, slot.hour);

                                return (
                                    <div key={slot.hour} className={styles.mobileTimeSlot}>
                                        <div className={styles.mobileTimeLabel}>
                                            {slot.display}
                                        </div>
                                        <div
                                            className={`${styles.mobileTimeContent} ${isSelected ? styles.selected : ''}`}
                                            onClick={() => handleTimeSlotClick(mobileCurrentDay, slot.hour)}
                                            onDoubleClick={() => handleTimeSlotDoubleClick(mobileCurrentDay, slot.hour)}
                                        >
                                            {isSelected && (
                                                <button
                                                    className={styles.scheduleButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setStartHour(slot.hour); // Set start hour based on selected slot
                                                        setStartMinute(0); // Reset minutes to 00
                                                        setShowScheduleModal(true);
                                                    }}
                                                >
                                                    Schedule
                                                </button>
                                            )}

                                            {blocksInSlot.map((block) => {
                                                // Calculate height based on duration (60px per hour)
                                                const heightPercentage = (block.duration / 60) * 100;
                                                const blockHeight = `${heightPercentage}%`;
                                                
                                                // Calculate top offset based on minutes past the hour
                                                const blockStart = new Date(block.start_time);
                                                const minutes = blockStart.getMinutes();
                                                const topOffset = `${(minutes / 60) * 100}%`;
                                                
                                                return (
                                                    <div
                                                        key={block.id}
                                                        className={styles.timeBlock}
                                                        style={{
                                                            backgroundColor: getTimeBlockColor(block),
                                                            height: blockHeight,
                                                            top: topOffset,
                                                            cursor: 'pointer'
                                                        }}
                                                        onMouseEnter={() => setHoveredBlockId(block.id)}
                                                        onMouseLeave={() => setHoveredBlockId(null)}
                                                        onClick={(e) => handleTimeBlockClick(block, e)}
                                                    >
                                                        <div className={styles.timeBlockTitle}>
                                                            {block.task_title || block.task_description || `Task ${block.task_id}`}
                                                        </div>
                                                    {hoveredBlockId === block.id && (
                                                        <button
                                                            className={styles.deleteButton}
                                                            onClick={(e) => openDeleteModal(block.id, e)}
                                                            aria-label="Delete time block"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <circle cx="8" cy="8" r="7" fill="white" stroke="currentColor" strokeWidth="1"/>
                                                                <path d="M5 5L11 11M11 5L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                                            </svg>
                                                        </button>
                                                    )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Modal */}
            {showScheduleModal && (
                <div className={styles.modalOverlay} onClick={resetModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>Schedule Task</div>
                            {selectedTimeSlot && (
                                <div className={styles.modalSubHeader}>
                                    {daysOfWeek[parseInt(selectedTimeSlot.split('-')[0])].name}, {daysOfWeek[parseInt(selectedTimeSlot.split('-')[0])].dayNumber} at {formatTime(startHour, startMinute)}
                                </div>
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Select Task</label>
                            <div className={styles.taskListContainer}>
                                {taskHierarchy.map((objective) => (
                                    <div key={objective.id} className={styles.objectiveSection}>
                                        <div className={`${styles.hierarchyItem} ${styles.objective}`}>
                                            {objective.title}
                                        </div>
                                        {objective.keyResults.map((keyResult) => (
                                            <div key={keyResult.id}>
                                                <div className={`${styles.hierarchyItem} ${styles.keyResult}`}>
                                                    {keyResult.title}
                                                </div>
                                                {keyResult.tasks.map((task) => (
                                                    <div
                                                        key={task.id}
                                                        className={`${styles.hierarchyItem} ${styles.taskItem}`}
                                                        onClick={() => handleTaskSelect(task.id, task.title, objective.id)}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="selectedTask"
                                                            checked={selectedTask === task.id}
                                                            onChange={() => handleTaskSelect(task.id, task.title, objective.id)}
                                                            className={styles.radioButton}
                                                        />
                                                        <span className={styles.taskTitle}>{task.title}</span>
                                                        <span className={styles.taskStatus}>
                                                            ({task.task_status})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {taskHierarchy.length === 0 && (
                                    <div className={styles.noTasks}>
                                        No tasks available
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Start Time</label>
                            <div className={styles.timePickerContainer}>
                                <select
                                    className={styles.timeSelect}
                                    value={startHour}
                                    onChange={(e) => setStartHour(Number(e.target.value))}
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i}>
                                            {i.toString().padStart(2, '0')}
                                        </option>
                                    ))}
                                </select>
                                <span className={styles.timeSeparator}>:</span>
                                <select
                                    className={styles.timeSelect}
                                    value={startMinute}
                                    onChange={(e) => setStartMinute(Number(e.target.value))}
                                >
                                    <option value={0}>00</option>
                                    <option value={15}>15</option>
                                    <option value={30}>30</option>
                                    <option value={45}>45</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Allocate</label>
                            <select
                                className={styles.formSelect}
                                value={selectedDuration}
                                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                            >
                                {DURATION_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                                onClick={resetModal}
                            >
                                Cancel
                            </button>
                            <button
                                className={`${styles.modalButton} ${styles.modalButtonCreate}`}
                                onClick={handleSchedule}
                                disabled={!selectedTask || loading}
                            >
                                {loading ? 'Scheduling...' : 'Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className={styles.modalOverlay} onClick={closeDeleteModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            Unblock Time
                        </div>
                        <div className={styles.deleteModalContent}>
                            Are you sure you want to unblock this time?
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                                onClick={closeDeleteModal}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className={`${styles.modalButton} ${styles.modalButtonDelete}`}
                                onClick={handleDeleteTimeBlock}
                                disabled={loading}
                            >
                                {loading ? 'Unblocking...' : 'Unblock'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Update Modal */}
            <TaskUpdateModal
                isOpen={showTaskUpdateModal}
                onClose={closeTaskUpdateModal}
                task={selectedTimeBlock}
                onSave={handleTaskUpdate}
                onDelete={handleDeleteFromModal}
                timeBlockId={selectedTimeBlock?.timeBlockId}
            />
        </div>
    );
}