import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Target, 
  Plus, 
  X, 
  Bell, 
  Clock, 
  Briefcase, 
  User, 
  Check, 
  Trash2,
  Maximize2
} from 'lucide-react';

// --- Utility Functions ---
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WORK_DAYS = ["M", "T", "W", "Th", "F"];
const CURRENT_YEAR = 2026;

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const formatDateKey = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'tracker'

  // Calendar State
  const [calendarMode, setCalendarMode] = useState('work'); // 'work' or 'personal'
  const [events, setEvents] = useState({}); // { 'work_2026-05-11': [{id, text, time, reminder}] }
  const [groups, setGroups] = useState([]); // [{id, mode, start: '2026-05-11', end: '2026-05-15'}]

  // Grouping State
  const [isGroupingMode, setIsGroupingMode] = useState(false);
  const [groupStart, setGroupStart] = useState(null);

  // Modals
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // Tracker State
  const [trackerMonth, setTrackerMonth] = useState(4); // Default May
  const [trackerData, setTrackerData] = useState({}); // { '2026-04-row0-col1': { target: 10, actual: null, crossed: false } }
  const [activeCell, setActiveCell] = useState(null);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [trackerModalType, setTrackerModalType] = useState('target'); // 'target' or 'actual'

  // --- Calendar Logic ---

  const handleDayClick = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);

    if (isGroupingMode) {
      if (!groupStart) {
        setGroupStart(dateKey);
      } else {
        // End group
        const newGroup = {
          id: Date.now().toString(),
          mode: calendarMode,
          start: groupStart < dateKey ? groupStart : dateKey,
          end: groupStart > dateKey ? groupStart : dateKey
        };
        setGroups([...groups, newGroup]);
        setGroupStart(null);
        setIsGroupingMode(false);
      }
      return;
    }

    setSelectedDate({ year, month, day, dateKey });
    setIsEventModalOpen(true);
  };

  const getDayEvents = (dateKey) => {
    return events[`${calendarMode}_${dateKey}`] || [];
  };

  const isDayGrouped = (dateKey) => {
    return groups.filter(g => g.mode === calendarMode && dateKey >= g.start && dateKey <= g.end);
  };

  // --- Tracker Logic ---

  const handleTrackerCellTap = (rowIndex, colIndex) => {
    const cellKey = `${trackerMonth}-${rowIndex}-${colIndex}`;
    const cellData = trackerData[cellKey];

    if (!cellData || !cellData.target) {
      setActiveCell(cellKey);
      setTrackerModalType('target');
      setIsTrackerModalOpen(true);
    } else {
      // Toggle crossed status
      setTrackerData(prev => ({
        ...prev,
        [cellKey]: { ...prev[cellKey], crossed: !prev[cellKey].crossed, actual: null }
      }));
    }
  };

  const handleTrackerCellLongPress = (rowIndex, colIndex) => {
    const cellKey = `${trackerMonth}-${rowIndex}-${colIndex}`;
    const cellData = trackerData[cellKey];

    if (cellData && cellData.target) {
      setActiveCell(cellKey);
      setTrackerModalType('actual');
      setIsTrackerModalOpen(true);
    }
  };

  // Custom hook for long press
  const useLongPress = (onLongPress, onClick, { shouldPreventDefault = true, delay = 500 } = {}) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timeout = useRef();
    const target = useRef();

    const start = (event) => {
      if (shouldPreventDefault && event.target) {
        event.target.addEventListener('touchend', preventDefault, { passive: false });
        target.current = event.target;
      }
      setLongPressTriggered(false);
      timeout.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    };

    const clear = (event, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current);
      shouldTriggerClick && !longPressTriggered && onClick(event);
      setLongPressTriggered(false);
      if (shouldPreventDefault && target.current) {
        target.current.removeEventListener('touchend', preventDefault);
      }
    };

    const preventDefault = (event) => {
      if (event.touches.length < 2 && event.preventDefault) {
        event.preventDefault();
      }
    };

    return {
      onMouseDown: start,
      onTouchStart: start,
      onMouseUp: clear,
      onMouseLeave: (e) => clear(e, false),
      onTouchEnd: clear,
    };
  };

  // --- Components ---

  const EventModal = () => {
    if (!isEventModalOpen || !selectedDate) return null;
    const { dateKey } = selectedDate;
    const dayEvents = getDayEvents(dateKey);
    const [newPlan, setNewPlan] = useState('');
    const [newTime, setNewTime] = useState('');
    const [hasReminder, setHasReminder] = useState(false);

    const savePlan = () => {
      if (!newPlan.trim()) return;

      const newEvent = {
        id: Date.now().toString(),
        text: newPlan,
        time: newTime,
        reminder: hasReminder
      };

      const storageKey = `${calendarMode}_${dateKey}`;
      setEvents(prev => ({
        ...prev,
        [storageKey]: [...(prev[storageKey] || []), newEvent]
      }));

      setNewPlan('');
      setNewTime('');
      setHasReminder(false);
    };

    const deletePlan = (id) => {
      const storageKey = `${calendarMode}_${dateKey}`;
      setEvents(prev => ({
        ...prev,
        [storageKey]: prev[storageKey].filter(e => e.id !== id)
      }));
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4">
        <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-bold">
              {MONTHS[selectedDate.month]} {selectedDate.day}, {selectedDate.year}
            </h3>
            <button onClick={() => setIsEventModalOpen(false)} className="p-2 bg-gray-100 rounded-full">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
            {dayEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">No plans for this day yet.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{ev.text}</p>
                      {(ev.time || ev.reminder) && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-blue-600 font-medium">
                          {ev.time && <span className="flex items-center gap-1"><Clock size={12} /> {ev.time}</span>}
                          {ev.reminder && <span className="flex items-center gap-1 text-orange-500"><Bell size={12} /> Reminder Set</span>}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deletePlan(ev.id)} className="text-red-400 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Add New Plan</h4>
              <input
                type="text"
                placeholder="What's the plan?"
                className="w-full p-3 border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newPlan}
                onChange={e => setNewPlan(e.target.value)}
              />
              <div className="flex gap-2 mb-4">
                <input
                  type="time"
                  className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                />
                <button
                  onClick={() => setHasReminder(!hasReminder)}
                  className={`p-3 rounded-lg border flex items-center justify-center transition-colors ${
                    hasReminder ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <Bell size={20} />
                </button>
              </div>
              <button
                onClick={savePlan}
                disabled={!newPlan.trim()}
                className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus size={18} /> Add Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TrackerModal = () => {
    if (!isTrackerModalOpen) return null;
    const [inputValue, setInputValue] = useState('');

    const handleSave = () => {
      const num = parseInt(inputValue, 10);
      if (isNaN(num)) return;

      if (trackerModalType === 'target') {
        setTrackerData(prev => ({
          ...prev,
          [activeCell]: { target: num, actual: null, crossed: false }
        }));
      } else {
        // Actual mode
        const currentTarget = trackerData[activeCell]?.target || 0;
        setTrackerData(prev => ({
          ...prev,
          [activeCell]: { ...prev[activeCell], actual: num, crossed: true }
        }));
      }
      setIsTrackerModalOpen(false);
      setInputValue('');
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4">
            {trackerModalType === 'target' ? 'Set Target Number' : 'Enter Actual Hit'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {trackerModalType === 'target' ? 'What is the goal for this day?' : 'You missed the target. What was the actual number hit?'}
          </p>
          <input
            type="number"
            autoFocus
            placeholder={trackerModalType === 'target' ? 'e.g., 100' : 'e.g., 85'}
            className="w-full p-4 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl mb-6 focus:outline-none focus:border-blue-500"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
          <div className="flex gap-3">
            <button 
              onClick={() => {
                if (trackerModalType === 'target') {
                  // Allow clearing target
                   setTrackerData(prev => {
                     const newData = {...prev};
                     delete newData[activeCell];
                     return newData;
                   });
                }
                setIsTrackerModalOpen(false);
              }} 
              className="flex-1 p-3 bg-gray-100 rounded-xl font-bold text-gray-600"
            >
              {trackerModalType === 'target' ? 'Clear' : 'Cancel'}
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render individual month for Calendar view
  const renderCalendarMonth = (monthIndex) => {
    const daysInMonth = getDaysInMonth(CURRENT_YEAR, monthIndex);
    const firstDay = getFirstDayOfMonth(CURRENT_YEAR, monthIndex);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div key={monthIndex} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 shrink-0 snap-start">
        <h2 className="text-xl font-extrabold text-gray-800 mb-4 flex items-center justify-between">
          <span>{MONTHS[monthIndex]} <span className="text-gray-400 font-medium ml-1">{CURRENT_YEAR}</span></span>
        </h2>

        <div className="grid grid-cols-7 gap-y-2 text-center text-sm mb-2">
          {DAYS.map((day, idx) => (
            <div key={idx} className={`font-bold ${idx === 0 || idx === 6 ? 'text-red-400' : 'text-gray-400'}`}>
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center relative z-10">
          {blanks.map(blank => <div key={`blank-${blank}`} className="p-2"></div>)}

          {days.map(day => {
            const dateKey = formatDateKey(CURRENT_YEAR, monthIndex, day);
            const hasEvents = getDayEvents(dateKey).length > 0;
            const activeGroups = isDayGrouped(dateKey);

            // Visual logic for groups (the overlapping pill effect)
            let groupClasses = "";
            let groupStyle = {};
            if (activeGroups.length > 0) {
              const group = activeGroups[0]; // just handle first group for simplicity
              const isStart = group.start === dateKey;
              const isEnd = group.end === dateKey;
              const isOnly = isStart && isEnd;

              groupClasses = "bg-blue-100/60 z-0 ";
              if (isOnly) groupClasses += "rounded-full ";
              else if (isStart) groupClasses += "rounded-l-full ml-1 ";
              else if (isEnd) groupClasses += "rounded-r-full mr-1 ";
            }

            const isSelecting = isGroupingMode && groupStart;
            const isSelectedGroupStart = groupStart === dateKey;

            return (
              <div key={day} className={`relative p-1 ${groupClasses}`}>
                <button
                  onClick={() => handleDayClick(CURRENT_YEAR, monthIndex, day)}
                  className={`
                    w-full aspect-square rounded-full flex flex-col items-center justify-center relative z-10
                    ${isSelectedGroupStart ? 'bg-orange-500 text-white animate-pulse' : ''}
                    ${hasEvents && !isSelectedGroupStart ? 'bg-white border-2 border-blue-600 font-bold shadow-sm' : 'hover:bg-gray-100 font-medium text-gray-700'}
                  `}
                >
                  <span className="text-base leading-none">{day}</span>
                  {hasEvents && !isSelectedGroupStart && (
                    <span className="absolute -bottom-1 w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Target Tracker Grid
  const renderTrackerGrid = () => {
    // 5 rows (weeks), 5 columns (M-F)
    const rows = [0, 1, 2, 3, 4];
    const cols = [0, 1, 2, 3, 4];

    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-gray-800 flex items-center">
            {MONTHS[trackerMonth]} Target
          </h2>
          <select 
            value={trackerMonth} 
            onChange={(e) => setTrackerMonth(parseInt(e.target.value))}
            className="bg-gray-50 border-gray-200 text-gray-700 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>

        <div className="min-w-[300px]">
          {/* Header */}
          <div className="grid grid-cols-5 border-b-2 border-gray-800">
            {WORK_DAYS.map(day => (
              <div key={day} className="py-3 text-center font-bold text-gray-700 border-r border-gray-200 last:border-0">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body */}
          {rows.map(row => (
            <div key={`row-${row}`} className="grid grid-cols-5 border-b border-gray-200 last:border-b-2 last:border-gray-800">
              {cols.map(col => {
                const cellKey = `${trackerMonth}-${row}-${col}`;
                const cellData = trackerData[cellKey];

                const LongPressableCell = () => {
                  const bind = useLongPress(
                    () => handleTrackerCellLongPress(row, col),
                    () => handleTrackerCellTap(row, col)
                  );

                  return (
                    <div 
                      {...bind}
                      className="relative h-20 border-r border-gray-200 last:border-0 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors select-none touch-manipulation"
                    >
                      {cellData && cellData.target ? (
                        <>
                          <span className="text-xl font-bold text-gray-800">{cellData.target}</span>

                          {/* Cross Out Line */}
                          {cellData.crossed && (
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                              <div className="w-[120%] h-0.5 bg-red-500 -rotate-[35deg]"></div>
                            </div>
                          )}

                          {/* Deficit Indicator */}
                          {cellData.crossed && cellData.actual !== null && cellData.actual < cellData.target && (
                            <div className="absolute top-1 right-1 text-[10px] font-extrabold text-red-600 bg-red-100 rounded p-0.5 px-1 leading-none shadow-sm border border-red-200">
                              -{cellData.target - cellData.actual}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300 opacity-50"><Plus size={20} /></span>
                      )}
                    </div>
                  );
                };

                return <LongPressableCell key={cellKey} />;
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="flex items-center gap-2"><span className="w-4 h-4 bg-gray-200 rounded flex items-center justify-center"><Plus size={12}/></span> Tap empty cell to set goal.</p>
          <p className="flex items-center gap-2"><span className="w-4 h-4 border border-gray-400 rounded flex items-center justify-center">10</span> Tap number to mark as done.</p>
          <p className="flex items-center gap-2"><span className="w-4 h-4 bg-red-100 border border-red-200 text-red-600 rounded flex items-center justify-center text-[10px]">-</span> Long-press to record misses.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans flex flex-col w-full max-w-md mx-auto relative shadow-2xl overflow-hidden sm:border-x border-gray-200">

      {/* Top Header */}
      <header className="bg-white px-4 pt-8 pb-4 shadow-sm z-20 flex justify-between items-center relative">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-800">
          {activeTab === 'calendar' ? 'Schedule' : 'Tracker'}
        </h1>

        {activeTab === 'calendar' && (
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setCalendarMode('work')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${calendarMode === 'work' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Briefcase size={16} /> Work
            </button>
            <button
              onClick={() => setCalendarMode('personal')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${calendarMode === 'personal' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <User size={16} /> Personal
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'calendar' ? (
          <div className="h-full flex flex-col relative">

            {/* Grouping Toolbar */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center z-10 shrink-0">
              <span className="text-sm font-medium text-gray-600">
                {isGroupingMode ? (groupStart ? 'Select End Date' : 'Select Start Date') : 'Group multiple days'}
              </span>
              <button
                onClick={() => {
                  setIsGroupingMode(!isGroupingMode);
                  setGroupStart(null);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  isGroupingMode ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Maximize2 size={16} /> {isGroupingMode ? 'Cancel' : 'Group Days'}
              </button>
            </div>

            {/* Scrollable Calendar */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 snap-y snap-mandatory bg-gray-100 scroll-smooth">
              {[...Array(12)].map((_, i) => renderCalendarMonth(i))}
            </div>

          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 pb-24">
            {renderTrackerGrid()}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 pb-safe pt-2 px-6 flex justify-around items-center pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20 rounded-t-2xl">
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${activeTab === 'calendar' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <CalendarIcon size={24} className={activeTab === 'calendar' ? 'stroke-[2.5px]' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Calendar</span>
        </button>
        <button 
          onClick={() => setActiveTab('tracker')}
          className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${activeTab === 'tracker' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Target size={24} className={activeTab === 'tracker' ? 'stroke-[2.5px]' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Tracker</span>
        </button>
      </nav>

      {/* Modals */}
      <EventModal />
      <TrackerModal />

    </div>
  );
}