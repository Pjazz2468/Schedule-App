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
  Maximize2,
  ZoomIn,
  ZoomOut,
  TrendingUp
} from 'lucide-react';

// --- Utility Functions ---
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WORK_DAYS = ["M", "T", "W", "Th", "F"];
const CURRENT_YEAR = 2026;

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const formatDateKey = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// --- localStorage helpers ---
const load = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export default function App() {
  const [activeTab, setActiveTab] = useState(() => load('activeTab', 'calendar'));

  // Calendar State
  const [calendarMode, setCalendarMode] = useState(() => load('calendarMode', 'work'));
  const [events, setEvents] = useState(() => load('events', {}));
  const [groups, setGroups] = useState(() => load('groups', []));

  // Grouping State
  const [isGroupingMode, setIsGroupingMode] = useState(false);
  const [groupStart, setGroupStart] = useState(null);

  // Zoom State
  const [isZoomed, setIsZoomed] = useState(false);

  // Modals
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // Tracker State
  const [trackerMonth, setTrackerMonth] = useState(() => load('trackerMonth', 4));
  const [trackerData, setTrackerData] = useState(() => load('trackerData', {}));
  const [activeCell, setActiveCell] = useState(null);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [trackerModalType, setTrackerModalType] = useState('target');

  // --- Persist to localStorage ---
  useEffect(() => { save('activeTab', activeTab); }, [activeTab]);
  useEffect(() => { save('calendarMode', calendarMode); }, [calendarMode]);
  useEffect(() => { save('events', events); }, [events]);
  useEffect(() => { save('groups', groups); }, [groups]);
  useEffect(() => { save('trackerMonth', trackerMonth); }, [trackerMonth]);
  useEffect(() => { save('trackerData', trackerData); }, [trackerData]);

  // --- Calendar Logic ---

  const handleDayClick = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);

    if (isGroupingMode) {
      if (!groupStart) {
        setGroupStart(dateKey);
      } else {
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
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {MONTHS[selectedDate.month]} {selectedDate.day}, {selectedDate.year}
            </h3>
            <button onClick={() => setIsEventModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900">
            {dayEvents.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">No plans for this day yet.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{ev.text}</p>
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

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Add New Plan</h4>
              <input
                type="text"
                placeholder="What's the plan?"
                className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                value={newPlan}
                onChange={e => setNewPlan(e.target.value)}
              />
              <div className="flex gap-2 mb-4">
                <input
                  type="time"
                  className="flex-1 p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                />
                <button
                  onClick={() => setHasReminder(!hasReminder)}
                  className={`p-3 rounded-lg border flex items-center justify-center transition-colors ${
                    hasReminder ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
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
        <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            {trackerModalType === 'target' ? 'Set Target Number' : 'Enter Actual Hit'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {trackerModalType === 'target' ? 'What is the goal for this day?' : 'You missed the target. What was the actual number hit?'}
          </p>
          <input
            type="number"
            autoFocus
            placeholder={trackerModalType === 'target' ? 'e.g., 100' : 'e.g., 85'}
            className="w-full p-4 text-2xl font-bold text-center border-2 border-gray-200 dark:border-gray-600 rounded-xl mb-6 focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
          <div className="flex gap-3">
            <button 
              onClick={() => {
                if (trackerModalType === 'target') {
                  setTrackerData(prev => {
                    const newData = {...prev};
                    delete newData[activeCell];
                    return newData;
                  });
                }
                setIsTrackerModalOpen(false);
              }} 
              className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300"
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
      <div key={monthIndex} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 shrink-0 snap-start">
        <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 mb-4 flex items-center justify-between">
          <span>{MONTHS[monthIndex]} <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">{CURRENT_YEAR}</span></span>
        </h2>

        <div className="grid grid-cols-7 gap-y-1 text-center text-sm mb-2">
          {DAYS.map((day, idx) => (
            <div key={idx} className={`font-bold ${idx === 0 || idx === 6 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center relative z-10">
          {blanks.map(blank => <div key={`blank-${blank}`} className={isZoomed ? "min-h-14" : "p-2"}></div>)}

          {days.map(day => {
            const dateKey = formatDateKey(CURRENT_YEAR, monthIndex, day);
            const dayEvents = getDayEvents(dateKey);
            const hasEvents = dayEvents.length > 0;
            const activeGroups = isDayGrouped(dateKey);

            let groupClasses = "";
            if (activeGroups.length > 0) {
              const group = activeGroups[0];
              const isStart = group.start === dateKey;
              const isEnd = group.end === dateKey;
              const isOnly = isStart && isEnd;

              groupClasses = "bg-blue-100/60 dark:bg-blue-900/40 z-0 ";
              if (isOnly) groupClasses += "rounded-lg ";
              else if (isStart) groupClasses += "rounded-l-lg ml-0.5 ";
              else if (isEnd) groupClasses += "rounded-r-lg mr-0.5 ";
            }

            const isSelectedGroupStart = groupStart === dateKey;

            if (isZoomed) {
              return (
                <div key={day} className={`relative flex flex-col items-center px-0.5 pb-1 min-h-14 ${groupClasses}`}>
                  <button
                    onClick={() => handleDayClick(CURRENT_YEAR, monthIndex, day)}
                    className={`
                      w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 relative z-10 text-sm font-bold
                      ${isSelectedGroupStart ? 'bg-orange-500 text-white animate-pulse' : ''}
                      ${hasEvents && !isSelectedGroupStart ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}
                    `}
                  >
                    {day}
                  </button>
                  {dayEvents.slice(0, 2).map((ev, i) => (
                    <p key={i} className="w-full text-[9px] leading-tight text-blue-700 dark:text-blue-300 font-semibold truncate px-0.5 mt-0.5">
                      {ev.text}
                    </p>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-[8px] text-gray-400 dark:text-gray-500">+{dayEvents.length - 2}</p>
                  )}
                </div>
              );
            }

            return (
              <div key={day} className={`relative p-1 ${groupClasses}`}>
                <button
                  onClick={() => handleDayClick(CURRENT_YEAR, monthIndex, day)}
                  className={`
                    w-full aspect-square rounded-full flex flex-col items-center justify-center relative z-10
                    ${isSelectedGroupStart ? 'bg-orange-500 text-white animate-pulse' : ''}
                    ${hasEvents && !isSelectedGroupStart ? 'bg-white dark:bg-gray-700 border-2 border-blue-600 font-bold shadow-sm text-gray-900 dark:text-gray-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300'}
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
    const rows = [0, 1, 2, 3, 4];
    const cols = [0, 1, 2, 3, 4];

    // Monthly summary stats
    const allCells = rows.flatMap(r => cols.map(c => trackerData[`${trackerMonth}-${r}-${c}`]));
    const withTarget = allCells.filter(c => c && c.target);
    const hit = withTarget.filter(c => c.crossed && (c.actual === null || c.actual >= c.target));
    const missed = withTarget.filter(c => c.crossed && c.actual !== null && c.actual < c.target);
    const pending = withTarget.filter(c => !c.crossed);
    const score = withTarget.length > 0 ? Math.round((hit.length / withTarget.length) * 100) : null;

    return (
      <div className="space-y-4">

      {/* Monthly Summary Card */}
      {withTarget.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" /> {MONTHS[trackerMonth]} Summary
            </h2>
            <span className={`text-2xl font-extrabold ${score >= 80 ? 'text-green-500' : score >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
              {score}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-2">
              <p className="text-xl font-extrabold text-green-600">{hit.length}</p>
              <p className="text-[10px] font-bold text-green-600/80 uppercase tracking-wider">Hit</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-2">
              <p className="text-xl font-extrabold text-red-500">{missed.length}</p>
              <p className="text-[10px] font-bold text-red-500/80 uppercase tracking-wider">Missed</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
              <p className="text-xl font-extrabold text-gray-600 dark:text-gray-300">{pending.length}</p>
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Left</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 flex items-center">
            {MONTHS[trackerMonth]} Target
          </h2>
          <select 
            value={trackerMonth} 
            onChange={(e) => setTrackerMonth(parseInt(e.target.value))}
            className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>

        <div className="min-w-[300px]">
          <div className="grid grid-cols-5 border-b-2 border-gray-800 dark:border-gray-400">
            {WORK_DAYS.map(day => (
              <div key={day} className="py-3 text-center font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-0">
                {day}
              </div>
            ))}
          </div>

          {rows.map(row => (
            <div key={`row-${row}`} className="grid grid-cols-5 border-b border-gray-200 dark:border-gray-700 last:border-b-2 last:border-gray-800 dark:last:border-gray-400">
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
                      className="relative h-20 border-r border-gray-200 dark:border-gray-700 last:border-0 flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors select-none touch-manipulation"
                    >
                      {cellData && cellData.target ? (
                        <>
                          <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{cellData.target}</span>

                          {cellData.crossed && (
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                              <div className="w-[120%] h-0.5 bg-red-500 -rotate-[35deg]"></div>
                            </div>
                          )}

                          {cellData.crossed && cellData.actual !== null && cellData.actual < cellData.target && (
                            <div className="absolute top-1 right-1 text-[10px] font-extrabold text-red-600 bg-red-100 dark:bg-red-900/50 rounded p-0.5 px-1 leading-none shadow-sm border border-red-200 dark:border-red-700">
                              -{cellData.target - cellData.actual}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 opacity-50"><Plus size={20} /></span>
                      )}
                    </div>
                  );
                };

                return <LongPressableCell key={cellKey} />;
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <p className="flex items-center gap-2"><span className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center"><Plus size={12}/></span> Tap empty cell to set goal.</p>
          <p className="flex items-center gap-2"><span className="w-4 h-4 border border-gray-400 dark:border-gray-500 rounded flex items-center justify-center">10</span> Tap number to mark as done.</p>
          <p className="flex items-center gap-2"><span className="w-4 h-4 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-600 rounded flex items-center justify-center text-[10px]">-</span> Long-press to record misses.</p>
        </div>
      </div>

      </div>
    );
  };

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans flex flex-col w-full max-w-md mx-auto relative shadow-2xl overflow-hidden sm:border-x border-gray-200 dark:border-gray-700">

      {/* Top Header */}
      <header className="bg-white dark:bg-gray-800 px-4 pt-8 pb-4 shadow-sm z-20 flex justify-between items-center relative">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-800 dark:text-gray-100">
          {activeTab === 'calendar' ? 'Schedule' : 'Tracker'}
        </h1>

        {activeTab === 'calendar' && (
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
            <button
              onClick={() => setCalendarMode('work')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${calendarMode === 'work' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <Briefcase size={16} /> Work
            </button>
            <button
              onClick={() => setCalendarMode('personal')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${calendarMode === 'personal' ? 'bg-white dark:bg-gray-600 shadow-sm text-purple-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
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
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-10 shrink-0 gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                {isGroupingMode ? (groupStart ? 'Select End Date' : 'Select Start Date') : 'Group multiple days'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsZoomed(z => !z)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    isZoomed ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {isZoomed ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
                  {isZoomed ? 'Compact' : 'Detailed'}
                </button>
                <button
                  onClick={() => {
                    setIsGroupingMode(!isGroupingMode);
                    setGroupStart(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    isGroupingMode ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Maximize2 size={15} /> {isGroupingMode ? 'Cancel' : 'Group'}
                </button>
              </div>
            </div>

            {/* Scrollable Calendar */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 snap-y snap-mandatory bg-gray-100 dark:bg-gray-900 scroll-smooth">
              {[...Array(12)].map((_, i) => renderCalendarMonth(i))}
            </div>

          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 pb-24 bg-gray-100 dark:bg-gray-900">
            {renderTrackerGrid()}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe pt-2 px-6 flex justify-around items-center pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-20 rounded-t-2xl">
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${activeTab === 'calendar' ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <CalendarIcon size={24} className={activeTab === 'calendar' ? 'stroke-[2.5px]' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Calendar</span>
        </button>
        <button 
          onClick={() => setActiveTab('tracker')}
          className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${activeTab === 'tracker' ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
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
