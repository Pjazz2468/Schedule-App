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
  TrendingUp,
  CalendarCheck,
  Share2,
  LogOut,
  Shield,
  Eye,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import { api } from './api.js';
import LoginPage from './LoginPage.jsx';

// --- Utility Functions ---
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["S","M","T","W","T","F","S"];
const WORK_DAYS = ["M","T","W","Th","F"];
const CURRENT_YEAR = 2026;

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const formatDateKey = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const load = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

export default function App() {
  // ── Auth (hooks before any early returns) ──
  const { user, isLoading: authLoading, logout } = useAuth();

  // ── Calendar State ──
  const [activeTab, setActiveTab] = useState(() => load('activeTab', 'calendar'));
  const [calendarMode, setCalendarMode] = useState(() => load('calendarMode', 'work'));
  const [events, setEvents] = useState(() => load('events', {}));
  const [groups, setGroups] = useState(() => load('groups', []));

  // ── Grouping ──
  const [isGroupingMode, setIsGroupingMode] = useState(false);
  const [groupStart, setGroupStart] = useState(null);

  // ── Zoom ──
  const [isZoomed, setIsZoomed] = useState(false);
  const calendarRef = useRef(null);
  const isZoomedRef = useRef(false);
  useEffect(() => { isZoomedRef.current = isZoomed; }, [isZoomed]);

  // ── Modals ──
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [dueReminders, setDueReminders] = useState([]);
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [upcomingReminders, setUpcomingReminders] = useState([]);

  // ── Tracker ──
  const [trackerMonth, setTrackerMonth] = useState(() => load('trackerMonth', 4));
  const [trackerData, setTrackerData] = useState(() => load('trackerData', {}));
  const [activeCell, setActiveCell] = useState(null);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [trackerModalType, setTrackerModalType] = useState('target');
  const [confirmReset, setConfirmReset] = useState(false);

  // ── Workspace / Sharing ──
  const [viewingUser, setViewingUser] = useState(null); // null = own workspace
  const [receivedShares, setReceivedShares] = useState([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const isReadOnly = !!viewingUser && viewingUser.role === 'contributor';
  const currentOwnerId = viewingUser?.owner_id || null;
  const canShare = !viewingUser && calendarMode === 'work';

  // ── Pinch-to-zoom ──
  useEffect(() => {
    const el = calendarRef.current;
    if (!el) return;
    let initialDist = null;
    const dist = (t) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const onStart = (e) => { if (e.touches.length === 2) initialDist = dist(e.touches); };
    const onMove = (e) => {
      if (e.touches.length !== 2 || initialDist === null) return;
      e.preventDefault();
      const scale = dist(e.touches) / initialDist;
      if (scale > 1.25 && !isZoomedRef.current) { isZoomedRef.current = true; setIsZoomed(true); }
      else if (scale < 0.8 && isZoomedRef.current) { isZoomedRef.current = false; setIsZoomed(false); }
    };
    const onEnd = (e) => { if (e.touches.length < 2) initialDist = null; };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  // ── Persist personal data ──
  useEffect(() => { save('activeTab', activeTab); }, [activeTab]);
  useEffect(() => { save('calendarMode', calendarMode); }, [calendarMode]);
  useEffect(() => {
    const personalEvents = Object.fromEntries(
      Object.entries(events).filter(([k]) => k.startsWith('personal_'))
    );
    save('events', personalEvents);
  }, [events]);
  useEffect(() => {
    const personalGroups = groups.filter(g => g.mode === 'personal');
    save('groups', personalGroups);
  }, [groups]);
  useEffect(() => { save('trackerMonth', trackerMonth); }, [trackerMonth]);

  // ── Load received shares ──
  useEffect(() => {
    if (!user) return;
    api.getReceivedShares().then(setReceivedShares).catch(() => {});
  }, [user]);

  // ── Load work data from API whenever workspace changes ──
  useEffect(() => {
    if (!user) return;
    const ownerId = currentOwnerId;
    setApiLoading(true);
    Promise.all([
      api.getEvents(ownerId),
      api.getGroups(ownerId),
      api.getTracker(ownerId),
    ]).then(([eventRows, groupRows, trackerRows]) => {
      setEvents(prev => {
        const personal = Object.fromEntries(
          Object.entries(prev).filter(([k]) => k.startsWith('personal_'))
        );
        const workMap = {};
        eventRows.forEach(({ date_key, events: evs }) => {
          workMap[`work_${date_key}`] = evs;
        });
        return { ...personal, ...workMap };
      });
      setGroups(prev => {
        const personalGroups = prev.filter(g => g.mode === 'personal');
        const workGroups = groupRows.map(r => ({
          id: String(r.id),
          mode: 'work',
          start: r.start_date,
          end: r.end_date,
        }));
        return [...personalGroups, ...workGroups];
      });
      const td = {};
      trackerRows.forEach(({ cell_key, data }) => { td[cell_key] = data; });
      setTrackerData(td);
    }).catch(() => {}).finally(() => setApiLoading(false));
  }, [user, viewingUser]); // eslint-disable-line

  // ── When switching to someone else's workspace, force Work mode ──
  useEffect(() => {
    if (viewingUser) {
      setCalendarMode('work');
      setIsGroupingMode(false);
      setGroupStart(null);
    }
  }, [viewingUser]);

  // ── Notifications ──
  const scheduleNotification = async (dateKey, text, timeStr) => {
    if (!timeStr || !('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    const [yr, mo, dy] = dateKey.split('-').map(Number);
    const [h, m] = timeStr.split(':').map(Number);
    const delay = new Date(yr, mo - 1, dy, h, m) - Date.now();
    if (delay <= 0) return;
    setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(text, {
          body: `Reminder at ${timeStr}`,
          icon: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: `event-${dateKey}-${timeStr}`,
        });
      } catch {
        new Notification(text, { body: `Reminder at ${timeStr}` });
      }
    }, delay);
  };

  useEffect(() => {
    Object.entries(events).forEach(([key, evList]) => {
      const dateKey = key.split('_').slice(1).join('_');
      evList.forEach(ev => {
        if (ev.reminder && ev.time) scheduleNotification(dateKey, ev.text, ev.time);
      });
    });
  }, []); // eslint-disable-line
  // ── Check for due/upcoming reminders on app open ──
  useEffect(() => {
    const now = new Date();
    const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
    const due = [];
    const upcoming = [];

    Object.entries(events).forEach(([key, evList]) => {
      const dateKey = key.split('_').slice(1).join('_');
      if (dateKey !== todayKey) return;
      evList.forEach(ev => {
        if (!ev.reminder || !ev.time) return;
        const [h, m] = ev.time.split(':').map(Number);
        const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        const diffMs = now - eventTime;
        const diffMinutes = diffMs / 60000;

        if (diffMinutes >= 0 && diffMinutes <= 120) {
          due.push({ ...ev, dateKey });
        } else if (diffMinutes < 0) {
          upcoming.push({ ...ev, dateKey });
        }
      });
    });

   if (due.length > 0) {
      setDueReminders(due);
      setShowReminderPopup(true);
    }
    setUpcomingReminders(upcoming);
  }, []); // eslint-disable-line

  // ── Today scroll ──
  const scrollToToday = () => {
    const todayMonth = new Date().getMonth();
    const el = document.getElementById(`month-${todayMonth}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Calendar Logic ──
  const handleDayClick = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    if (isGroupingMode) {
      if (!groupStart) {
        setGroupStart(dateKey);
      } else {
        const start = groupStart < dateKey ? groupStart : dateKey;
        const end = groupStart > dateKey ? groupStart : dateKey;
        if (calendarMode === 'work') {
          api.addGroup({ start, end }, currentOwnerId)
            .then(({ id }) => {
              setGroups(prev => [...prev, { id: String(id), mode: 'work', start, end }]);
            })
            .catch(() => {
              setGroups(prev => [...prev, { id: Date.now().toString(), mode: 'work', start, end }]);
            });
        } else {
          setGroups(prev => [...prev, { id: Date.now().toString(), mode: 'personal', start, end }]);
        }
        setGroupStart(null);
        setIsGroupingMode(false);
      }
      return;
    }
    setSelectedDate({ year, month, day, dateKey });
    setIsEventModalOpen(true);
  };

  const getDayEvents = (dateKey) => events[`${calendarMode}_${dateKey}`] || [];
  const isDayGrouped = (dateKey) =>
    groups.filter(g => g.mode === calendarMode && dateKey >= g.start && dateKey <= g.end);

  // ── Tracker Logic ──
  const handleTrackerCellTap = (rowIndex, colIndex) => {
    if (isReadOnly) return;
    const cellKey = `${trackerMonth}-${rowIndex}-${colIndex}`;
    const cellData = trackerData[cellKey];
    if (!cellData || !cellData.target) {
      setActiveCell(cellKey);
      setTrackerModalType('target');
      setIsTrackerModalOpen(true);
    } else {
      const updated = { ...cellData, crossed: !cellData.crossed, actual: null };
      setTrackerData(prev => ({ ...prev, [cellKey]: updated }));
      api.saveCell(cellKey, updated, currentOwnerId).catch(() => {});
    }
  };

  const handleTrackerCellLongPress = (rowIndex, colIndex) => {
    if (isReadOnly) return;
    const cellKey = `${trackerMonth}-${rowIndex}-${colIndex}`;
    const cellData = trackerData[cellKey];
    if (cellData && cellData.target) {
      setActiveCell(cellKey);
      setTrackerModalType('edit');
      setIsTrackerModalOpen(true);
    }
  };

  // ── Long Press Hook ──
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
      timeout.current = setTimeout(() => { onLongPress(event); setLongPressTriggered(true); }, delay);
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
      if (event.touches.length < 2 && event.preventDefault) event.preventDefault();
    };
    return {
      onMouseDown: start, onTouchStart: start,
      onMouseUp: clear, onMouseLeave: (e) => clear(e, false), onTouchEnd: clear,
    };
  };

  // ────────────────────────────────────────────
  // EARLY RETURNS (after all hooks)
  // ────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <LoginPage />;

  // ────────────────────────────────────────────
  // COMPONENTS
  // ────────────────────────────────────────────

  const ReminderPopup = () => {
    if (!showReminderPopup || dueReminders.length === 0) return null;
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={22} className="text-orange-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Reminders</h3>
          </div>
          <div className="flex flex-col gap-2 mb-5 max-h-60 overflow-y-auto">
            {dueReminders.map(ev => (
              <div key={ev.id} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{ev.text}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                  <Clock size={11} /> {ev.time}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowReminderPopup(false)}
            className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold"
          >
            Got it
          </button>
        </div>
      </div>
    );
  };
  const EventModal = () => {
    if (!isEventModalOpen || !selectedDate) return null;
    const { dateKey } = selectedDate;
    const dayEvents = getDayEvents(dateKey);
    const activeGroups = isDayGrouped(dateKey);
    const [newPlan, setNewPlan] = useState('');
    const [newTime, setNewTime] = useState('');
    const [hasReminder, setHasReminder] = useState(false);

    const removeGroup = (groupId) => {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (calendarMode === 'work') {
        api.deleteGroup(groupId, currentOwnerId).catch(() => {});
      }
    };

    const savePlan = () => {
      if (!newPlan.trim() || isReadOnly) return;
      const newEvent = { id: Date.now().toString(), text: newPlan, time: newTime, reminder: hasReminder };
      const storageKey = `${calendarMode}_${dateKey}`;
      const updatedEvents = [...(events[storageKey] || []), newEvent];
      setEvents(prev => ({ ...prev, [storageKey]: updatedEvents }));
      if (calendarMode === 'work') {
        api.saveEvents(dateKey, updatedEvents, currentOwnerId).catch(() => {});
      }
      if (hasReminder && newTime) scheduleNotification(dateKey, newPlan, newTime);
      setNewPlan(''); setNewTime(''); setHasReminder(false);
    };

    const deletePlan = (id) => {
      if (isReadOnly) return;
      const storageKey = `${calendarMode}_${dateKey}`;
      const remaining = (events[storageKey] || []).filter(e => e.id !== id);
      setEvents(prev => ({ ...prev, [storageKey]: remaining }));
      if (calendarMode === 'work') {
        api.saveEvents(dateKey, remaining, currentOwnerId).catch(() => {});
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4">
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {MONTHS[selectedDate.month]} {selectedDate.day}, {selectedDate.year}
              </h3>
              {viewingUser && (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {viewingUser.owner_name}'s Work Calendar · {isReadOnly ? 'View only' : 'Admin'}
                </p>
              )}
            </div>
            <button onClick={() => setIsEventModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
              <X size={20} />
            </button>
          </div>

          {activeGroups.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 flex flex-col gap-1.5">
              {activeGroups.map(g => (
                <div key={g.id} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Maximize2 size={12} /> Grouped: {g.start} → {g.end}
                  </span>
                  {!isReadOnly && (
                    <button onClick={() => removeGroup(g.id)} className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-2 py-1 rounded-lg">
                      <X size={11} /> Ungroup
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="p-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900">
            {dayEvents.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">No plans for this day yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{ev.text}</p>
                      {ev.time && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> {ev.time} {ev.reminder && <Bell size={11} className="text-orange-500" />}
                        </p>
                      )}
                    </div>
                    {!isReadOnly && (
                      <button onClick={() => deletePlan(ev.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-400 shrink-0">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isReadOnly && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Add a plan..."
                  value={newPlan}
                  onChange={e => setNewPlan(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePlan()}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="time"
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setHasReminder(!hasReminder)}
                    className={`p-3 rounded-lg border flex items-center justify-center transition-colors ${hasReminder ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'}`}
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
            )}
          </div>
        </div>
      </div>
    );
  };

  const TrackerModal = () => {
    if (!isTrackerModalOpen) return null;
    const currentCell = activeCell ? trackerData[activeCell] : null;
    const isEdit = trackerModalType === 'edit';
    const [targetVal, setTargetVal] = useState(isEdit && currentCell ? String(currentCell.target) : '');
    const [actualVal, setActualVal] = useState(isEdit && currentCell?.actual != null ? String(currentCell.actual) : '');
    const [inputValue, setInputValue] = useState('');

    const clearCell = () => {
      setTrackerData(prev => { const n = { ...prev }; delete n[activeCell]; return n; });
      api.deleteCell(activeCell, currentOwnerId).catch(() => {});
      setIsTrackerModalOpen(false);
    };

    const handleSave = () => {
      let newData;
      if (isEdit) {
        const tNum = parseInt(targetVal, 10);
        if (isNaN(tNum)) return;
        const aNum = parseInt(actualVal, 10);
        newData = {
          target: tNum,
          actual: isNaN(aNum) ? (trackerData[activeCell]?.actual ?? null) : aNum,
          crossed: trackerData[activeCell]?.crossed ?? false,
        };
      } else {
        const num = parseInt(inputValue, 10);
        if (isNaN(num)) return;
        newData = { target: num, actual: null, crossed: false };
      }
      setTrackerData(prev => ({ ...prev, [activeCell]: newData }));
      api.saveCell(activeCell, newData, currentOwnerId).catch(() => {});
      setIsTrackerModalOpen(false);
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6">
          {isEdit ? (
            <>
              <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-gray-100">Edit Cell</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Change the target or actual value.</p>
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Target</label>
                  <input type="number" autoFocus placeholder="e.g., 100"
                    className="w-full p-3 text-2xl font-bold text-center border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={targetVal} onChange={e => setTargetVal(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Actual <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <input type="number" placeholder="e.g., 85"
                    className="w-full p-3 text-2xl font-bold text-center border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={actualVal} onChange={e => setActualVal(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={clearCell} className="flex-1 p-3 bg-red-50 dark:bg-red-900/30 text-red-500 border border-red-200 dark:border-red-700 rounded-xl font-bold text-sm">Clear Cell</button>
                <button onClick={handleSave} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Save</button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Set Target Number</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">What is the goal for this day?</p>
              <input type="number" autoFocus placeholder="e.g., 100"
                className="w-full p-4 text-2xl font-bold text-center border-2 border-gray-200 dark:border-gray-600 rounded-xl mb-6 focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={inputValue} onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()} />
              <div className="flex gap-3">
                <button onClick={clearCell} className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">Clear</button>
                <button onClick={handleSave} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Save</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const ShareModal = () => {
    if (!isShareModalOpen) return null;
    const [shares, setShares] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('contributor');
    const [addError, setAddError] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    useEffect(() => {
      api.getShares().then(setShares).catch(() => {});
    }, []);

    const handleAdd = async () => {
      if (!newEmail.trim()) return;
      setAddError(''); setAddLoading(true);
      try {
        const share = await api.addShare(newEmail.trim(), newRole);
        setShares(prev => {
          const exists = prev.find(s => s.member_email === share.member_email);
          if (exists) return prev.map(s => s.member_email === share.member_email ? share : s);
          return [...prev, share];
        });
        setNewEmail('');
      } catch (err) {
        setAddError(err.message);
      } finally {
        setAddLoading(false);
      }
    };

    const handleChangeRole = async (id, role) => {
      try {
        const updated = await api.updateShare(id, role);
        setShares(prev => prev.map(s => s.id === updated.id ? updated : s));
      } catch {}
    };

    const handleRemove = async (id) => {
      await api.removeShare(id).catch(() => {});
      setShares(prev => prev.filter(s => s.id !== id));
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4">
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Share2 size={18} className="text-blue-500" /> Share Work Calendar
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">People can see your Work calendar & Tracker</p>
            </div>
            <button onClick={() => setIsShareModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {/* Add new person */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 mb-4 flex flex-col gap-3">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <UserPlus size={15} /> Add person
              </h4>
              <input
                type="email"
                placeholder="Email address"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="contributor">Contributor — view only</option>
                  <option value="admin">Admin — can edit</option>
                </select>
                <button
                  onClick={handleAdd}
                  disabled={addLoading || !newEmail.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50"
                >
                  {addLoading ? '…' : 'Add'}
                </button>
              </div>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
            </div>

            {/* Current shares */}
            {shares.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Not shared with anyone yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Shared with</h4>
                {shares.map(s => (
                  <div key={s.id} className="bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">{s.member_email[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{s.member_email}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {s.role === 'admin'
                          ? <><Shield size={11} className="text-purple-500" /><span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">Admin</span></>
                          : <><Eye size={11} className="text-gray-400" /><span className="text-[11px] text-gray-400 font-medium">Contributor</span></>
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={s.role}
                        onChange={e => handleChangeRole(s.id, e.target.value)}
                        className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
                      >
                        <option value="contributor">Contributor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={() => handleRemove(s.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Calendar Month Renderer ──
  const renderCalendarMonth = (monthIndex) => {
    const daysInMonth = getDaysInMonth(CURRENT_YEAR, monthIndex);
    const firstDay = getFirstDayOfMonth(CURRENT_YEAR, monthIndex);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div id={`month-${monthIndex}`} key={monthIndex} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 shrink-0 snap-start">
        <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 mb-4 flex items-center justify-between">
          <span>{MONTHS[monthIndex]} <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">{CURRENT_YEAR}</span></span>
        </h2>

        <div className="grid grid-cols-7 gap-y-1 text-center text-sm mb-2">
          {DAYS.map((day, idx) => (
            <div key={idx} className={`font-bold ${idx === 0 || idx === 6 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>{day}</div>
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
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 relative z-10 text-sm font-bold
                      ${isSelectedGroupStart ? 'bg-orange-500 text-white animate-pulse' : ''}
                      ${hasEvents && !isSelectedGroupStart ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                  >
                    {day}
                  </button>
                  <div className="w-full mt-0.5 flex flex-col gap-0.5 px-0.5">
                    {dayEvents.slice(0, 2).map((ev, i) => (
                      <div key={i} className="text-[9px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded px-1 py-0.5 truncate leading-tight">
                        {ev.time && <span className="opacity-70">{ev.time} </span>}{ev.text}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-gray-400 text-center">+{dayEvents.length - 2}</div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={day} className={`relative ${groupClasses}`}>
                <button
                  onClick={() => handleDayClick(CURRENT_YEAR, monthIndex, day)}
                  className={`w-full aspect-square rounded-full flex flex-col items-center justify-center relative z-10
                    ${isSelectedGroupStart ? 'bg-orange-500 text-white animate-pulse' : ''}
                    ${hasEvents && !isSelectedGroupStart ? 'bg-white dark:bg-gray-700 border-2 border-blue-600 font-bold shadow-sm text-gray-900 dark:text-gray-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300'}`}
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

  // ── Tracker Grid Renderer ──
  const renderTrackerGrid = () => {
    const rows = [0, 1, 2, 3, 4];
    const cols = [0, 1, 2, 3, 4];
    const allCells = rows.flatMap(r => cols.map(c => trackerData[`${trackerMonth}-${r}-${c}`]));
    const withTarget = allCells.filter(c => c && c.target);
    const hit = withTarget.filter(c => c.crossed && (c.actual === null || c.actual >= c.target));
    const missed = withTarget.filter(c => c.crossed && c.actual !== null && c.actual < c.target);
    const pending = withTarget.filter(c => !c.crossed);
    const score = withTarget.length > 0 ? Math.round((hit.length / withTarget.length) * 100) : null;

    return (
      <div className="space-y-4">
        {viewingUser && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl px-4 py-2.5 flex items-center gap-2">
            {isReadOnly ? <Eye size={14} className="text-blue-500" /> : <Shield size={14} className="text-purple-500" />}
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {viewingUser.owner_name}'s Tracker · {isReadOnly ? 'View only' : 'Admin access'}
            </span>
          </div>
        )}

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
            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
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
          <div className="flex justify-between items-center mb-6 gap-2">
            <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 shrink-0">{MONTHS[trackerMonth]} Target</h2>
            <div className="flex items-center gap-2">
              {!isReadOnly && (confirmReset ? (
                <>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Reset all?</span>
                  <button
                    onClick={() => {
                      setTrackerData(prev => {
                        const next = { ...prev };
                        Object.keys(next).filter(k => k.startsWith(`${trackerMonth}-`)).forEach(k => {
                          api.deleteCell(k, currentOwnerId).catch(() => {});
                          delete next[k];
                        });
                        return next;
                      });
                      setConfirmReset(false);
                    }}
                    className="text-xs font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg shrink-0"
                  >Yes, Reset</button>
                  <button onClick={() => setConfirmReset(false)} className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg shrink-0">Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-1.5 rounded-lg shrink-0">
                  <Trash2 size={12} /> Reset
                </button>
              ))}
              <select
                value={trackerMonth}
                onChange={e => { setTrackerMonth(parseInt(e.target.value)); setConfirmReset(false); }}
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg p-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="min-w-[300px]">
            <div className="grid grid-cols-5 border-b-2 border-gray-800 dark:border-gray-400">
              {WORK_DAYS.map(day => (
                <div key={day} className="py-3 text-center font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-0">{day}</div>
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
                        className={`relative h-20 border-r border-gray-200 dark:border-gray-700 last:border-0 flex items-center justify-center transition-colors select-none touch-manipulation ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        {cellData && cellData.target ? (
                          <>
                            <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{cellData.target}</span>
                            {cellData.crossed && (
                              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                                <div className="w-[120%] h-0.5 bg-red-500 -rotate-[35deg]"></div>
                              </div>
                            )}
                            {cellData.crossed && cellData.actual !== null && cellData.actual >= cellData.target && (
                              <div className="absolute top-1 right-1">
                                <Check size={14} className="text-green-500" />
                              </div>
                            )}
                            {cellData.crossed && cellData.actual !== null && cellData.actual < cellData.target && (
                              <div className="absolute top-1 right-1 text-[10px] font-extrabold text-red-600 bg-red-100 dark:bg-red-900/50 rounded p-0.5 px-1 leading-none shadow-sm border border-red-200 dark:border-red-700">
                                -{cellData.target - cellData.actual}
                              </div>
                            )}
                          </>
                        ) : (
                          !isReadOnly && <span className="text-gray-300 dark:text-gray-600 opacity-50"><Plus size={20} /></span>
                        )}
                      </div>
                    );
                  };

                  return <LongPressableCell key={cellKey} />;
                })}
              </div>
            ))}
          </div>

          {!isReadOnly && (
            <div className="mt-6 flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="flex items-center gap-2"><span className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center"><Plus size={12}/></span> Tap empty cell to set goal.</p>
              <p className="flex items-center gap-2"><span className="w-4 h-4 border border-gray-400 dark:border-gray-500 rounded flex items-center justify-center">10</span> Tap number to mark as done.</p>
              <p className="flex items-center gap-2"><span className="w-4 h-4 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-600 rounded flex items-center justify-center text-[10px]">-</span> Long-press to edit or clear.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans flex flex-col w-full max-w-md mx-auto relative shadow-2xl overflow-hidden sm:border-x border-gray-200 dark:border-gray-700">

      {/* Top Header */}
      <header className="bg-white dark:bg-gray-800 px-4 pt-12 pb-3 shadow-sm z-20 relative">
        {/* Row 1: title + user */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-800 dark:text-gray-100">
            {activeTab === 'calendar' ? 'Schedule' : 'Tracker'}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium max-w-[100px] truncate">{user.name}</span>
            {canShare && (
              <button onClick={() => setIsShareModalOpen(true)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Share calendar">
                <Share2 size={16} />
              </button>
            )}
            <button onClick={logout} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: workspace picker (if shared workspaces exist) + mode toggle */}
        <div className="flex items-center justify-between gap-2">
          {/* Workspace selector */}
          {(receivedShares.length > 0 || viewingUser) ? (
            <div className="relative">
              <button
                onClick={() => setWorkspaceOpen(!workspaceOpen)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${viewingUser ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
              >
                {viewingUser ? <Shield size={12} /> : <User size={12} />}
                {viewingUser ? `${viewingUser.owner_name}` : 'My Workspace'}
                <ChevronDown size={12} />
              </button>
              {workspaceOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden">
                  <button
                    onMouseDown={() => { setViewingUser(null); setWorkspaceOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${!viewingUser ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    <User size={14} /> My Workspace
                  </button>
                  {receivedShares.map(s => (
                    <button
                      key={s.id}
                      onMouseDown={() => { setViewingUser(s); setWorkspaceOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${viewingUser?.owner_id === s.owner_id ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {s.role === 'admin' ? <Shield size={14} className="text-purple-500" /> : <Eye size={14} className="text-gray-400" />}
                      {s.owner_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : <div />}

          {/* Work/Personal toggle (only for own workspace in calendar tab) */}
          {activeTab === 'calendar' && !viewingUser && (
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <button
                onClick={() => setCalendarMode('work')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${calendarMode === 'work' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}
              >
                <Briefcase size={16} /> Work
              </button>
              <button
                onClick={() => setCalendarMode('personal')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${calendarMode === 'personal' ? 'bg-white dark:bg-gray-600 shadow-sm text-purple-600' : 'text-gray-500 dark:text-gray-400'}`}
              >
                <User size={16} /> Personal
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Click-away for workspace dropdown */}
    
      {/* API Loading bar */}
      {apiLoading && (
        <div className="h-0.5 bg-gray-200 dark:bg-gray-700 overflow-hidden z-10">
          <div className="h-full bg-blue-500 animate-pulse w-full" />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'calendar' ? (
          <div className="h-full flex flex-col relative">
            {/* Grouping Toolbar */}
            {/* Reminders Banner */}
            {upcomingReminders.length > 0 && !viewingUser && (
              <div className="px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-700 flex items-center gap-2 shrink-0">
                <Bell size={14} className="text-orange-500 shrink-0" />
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 truncate">
                  {upcomingReminders.length} reminder{upcomingReminders.length > 1 ? 's' : ''} today: {upcomingReminders.map(r => `${r.time} ${r.text}`).join(', ')}
                </span>
              </div>
            )}
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-10 shrink-0 gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                {isGroupingMode
                  ? (groupStart ? 'Select End Date' : 'Select Start Date')
                  : isZoomed
                    ? <><ZoomOut size={14} className="shrink-0" /> Pinch in to compact</>
                    : <><ZoomIn size={14} className="shrink-0" /> Pinch out to expand</>
                }
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {!isGroupingMode && (
                  <button onClick={scrollToToday} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    <CalendarCheck size={15} /> Today
                  </button>
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => { setIsGroupingMode(!isGroupingMode); setGroupStart(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${isGroupingMode ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                  >
                    <Maximize2 size={15} /> {isGroupingMode ? 'Cancel' : 'Group'}
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Calendar */}
            <div ref={calendarRef} className="flex-1 overflow-y-auto p-4 pb-24 snap-y snap-mandatory bg-gray-100 dark:bg-gray-900 scroll-smooth touch-pan-y">
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
          className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${activeTab === 'calendar' ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <CalendarIcon size={24} className={activeTab === 'calendar' ? 'stroke-[2.5px]' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Calendar</span>
        </button>
        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${activeTab === 'tracker' ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <Target size={24} className={activeTab === 'tracker' ? 'stroke-[2.5px]' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Tracker</span>
        </button>
      </nav>

      {/* Modals */}
      <EventModal />
      <TrackerModal />
      <ShareModal />
      <ReminderPopup />
    </div>
  );
}
