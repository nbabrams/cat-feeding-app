// Cat Feeding Scheduler with Supabase Real-time Sync
// File: CatFeedingScheduler.jsx

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calendar, Cat, Sun, Moon, Check, User, Wifi, WifiOff } from 'lucide-react';

// Initialize Supabase client - Replace these with your actual values
const supabaseUrl = import.meta.env.REACT_APP_SUPABASE_URL || 'https://htpnrefiowyggnviwihg.supabase.co';
const supabaseAnonKey =
  import.meta.env.REACT_APP_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cG5yZWZpb3d5Z2dudml3aWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODI5MTEsImV4cCI6MjA3MjA1ODkxMX0.KvPQ_rxPpDboqrqwH8HrJQXg9JjJ8e603OZpeQtvH4I';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CatFeedingScheduler = () => {
  const startDate = new Date('2025-08-29');
  const endDate = new Date('2025-09-19');

  const generateDates = () => {
    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const allDates = generateDates();
  const neighbors = ['Karen', 'Hillary', 'Darlene', 'Kelly'];

  const [schedule, setSchedule] = useState({});
  const [selectedPerson, setSelectedPerson] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // ---- helper to update one slot locally (optimistic UI) ----
  function updateLocalSlot(dateKey, timeSlot, nextSlot) {
    setSchedule(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {
          morning: { person: null, completed: false },
          evening: { person: null, completed: false }
        }),
        [timeSlot]: nextSlot
      }
    }));
  }

  // Initialize or fetch schedule from Supabase
  useEffect(() => {
    fetchSchedule();

    // Set up real-time subscription
    const subscription = supabase
      .channel('schedule_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feeding_schedule' },
        payload => {
          // reconcile when realtime arrives
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('feeding_schedule').select('*');

      if (error) throw error;

      // Convert array data to our schedule object format
      const scheduleObj = {};
      allDates.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        scheduleObj[dateKey] = {
          morning: { person: null, completed: false },
          evening: { person: null, completed: false }
        };
      });

      // Populate with data from database
      data?.forEach(record => {
        if (scheduleObj[record.date]) {
          scheduleObj[record.date][record.time_slot] = {
            person: record.person,
            completed: record.completed
          };
        }
      });

      setSchedule(scheduleObj);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setLoading(false);
      setConnected(false);
    }
  };

  const handleRealtimeUpdate = payload => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    setSchedule(prev => {
      const updated = { ...prev };

      if (eventType === 'DELETE') {
        if (updated[oldRecord.date]) {
          updated[oldRecord.date][oldRecord.time_slot] = {
            person: null,
            completed: false
          };
        }
      } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (updated[newRecord.date]) {
          updated[newRecord.date][newRecord.time_slot] = {
            person: newRecord.person,
            completed: newRecord.completed
          };
        }
      }

      return updated;
    });

    setLastUpdate(new Date());
  };

  // ---------- OPTIMISTIC claim/unclaim ----------
  const handleSlotClick = async (dateKey, timeSlot) => {
    const current = schedule[dateKey]?.[timeSlot];

    // require a name only when claiming an empty slot
    if (!selectedPerson && !current?.person) {
      alert('Please select your name first!');
      return;
    }

    // keep a snapshot for rollback
    const prevSlot = current || { person: null, completed: false };

    try {
      if (current?.person) {
        // OPTIMISTIC: unclaim immediately
        updateLocalSlot(dateKey, timeSlot, { person: null, completed: false });

        const { error } = await supabase
          .from('feeding_schedule')
          .delete()
          .eq('date', dateKey)
          .eq('time_slot', timeSlot);

        if (error) throw error;
      } else {
        // OPTIMISTIC: claim immediately
        updateLocalSlot(dateKey, timeSlot, { person: selectedPerson, completed: false });

        const { error } = await supabase.from('feeding_schedule').upsert({
          date: dateKey,
          time_slot: timeSlot,
          person: selectedPerson,
          completed: false
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating slot:', error);
      // rollback UI if DB write failed
      updateLocalSlot(dateKey, timeSlot, prevSlot);
      alert('Failed to update. Please check your connection.');
    }
  };

  // ---------- OPTIMISTIC complete toggle ----------
  const handleCompleteToggle = async (dateKey, timeSlot) => {
    const current = schedule[dateKey]?.[timeSlot];
    if (!current?.person) return;

    const prev = current;
    const optimistic = { ...current, completed: !current.completed };

    try {
      updateLocalSlot(dateKey, timeSlot, optimistic);

      const { error } = await supabase
        .from('feeding_schedule')
        .update({ completed: optimistic.completed })
        .eq('date', dateKey)
        .eq('time_slot', timeSlot);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling completion:', error);
      updateLocalSlot(dateKey, timeSlot, prev);
      alert('Failed to update. Please check your connection.');
    }
  };

  const formatDate = date => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getSlotColor = slot => {
    if (slot?.completed) return 'bg-green-100 border-green-400';
    if (slot?.person) return 'bg-blue-100 border-blue-400';
    return 'bg-gray-50 border-gray-300 hover:bg-gray-100';
  };

  const getPersonColor = person => {
    const colors = {
      Karen: 'text-purple-700',
      Hillary: 'text-pink-700',
      Darlene: 'text-indigo-700',
      Kelly: 'text-teal-700'
    };
    return colors[person] || 'text-gray-700';
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Cat className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-bounce" />
            <p className="text-gray-600">Loading schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Cat className="w-8 h-8 text-orange-500" />
          <h1 className="text-3xl font-bold text-gray-800">Cat Feeding Schedule</h1>
          <Cat className="w-8 h-8 text-orange-500" />
        </div>
        <p className="text-gray-600">August 29 - September 19, 2025</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          {connected ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600">Live sync active</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-600">Connection lost</span>
            </>
          )}
          {lastUpdate && (
            <span className="text-xs text-gray-500 ml-2">Last update: {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <h3 className="font-semibold text-gray-700 mb-2">How to use:</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Select your name below</li>
          <li>Click on any morning or evening slot to claim it</li>
          <li>Click again to unclaim if needed</li>
          <li>Use the circle button to mark a feeding as completed</li>
          <li>Changes sync automatically for all users!</li>
        </ol>
      </div>

      <div className="mb-6 bg-blue-50 p-4 rounded-lg">
        <label className="block text-lg font-semibold mb-3 text-gray-700">
          <User className="inline w-5 h-5 mr-2" />
          Select Your Name:
        </label>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {neighbors.map(neighbor => (
            <button
              key={neighbor}
              onClick={() => setSelectedPerson(neighbor)}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedPerson === neighbor
                  ? 'bg-blue-500 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {neighbor}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-50 border border-gray-300 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-400 rounded"></div>
          <span>Claimed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-400 rounded"></div>
          <span>Completed</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allDates.map(date => {
          const dateKey = date.toISOString().split('T')[0];
          const daySchedule = schedule[dateKey] || {
            morning: { person: null, completed: false },
            evening: { person: null, completed: false }
          };
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div
              key={dateKey}
              className={`border rounded-lg p-4 ${isToday ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}
            >
              <div className="mb-3">
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(date)}
                </div>
                {isToday && <span className="text-xs text-orange-600 font-medium">TODAY</span>}
              </div>

              <div className="space-y-2">
                {/* Morning */}
                <div className={`border-2 rounded-lg p-3 transition-all ${getSlotColor(daySchedule.morning)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium text-sm">Morning</span>
                    </div>
                    {daySchedule.morning?.person && (
                      <button
                        onClick={() => handleCompleteToggle(dateKey, 'morning')}
                        className="p-1 rounded-full hover:bg-gray-200 transition-all"
                        title="Mark as completed"
                      >
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            daySchedule.morning.completed
                              ? 'bg-green-500 border-green-500'
                              : 'bg-white border-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {daySchedule.morning.completed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    )}
                  </div>
                  <button onClick={() => handleSlotClick(dateKey, 'morning')} className="w-full text-left">
                    {daySchedule.morning?.person ? (
                      <span className={`font-medium ${getPersonColor(daySchedule.morning.person)}`}>
                        {daySchedule.morning.person}
                        {daySchedule.morning.completed && ' ✓'}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">Click to claim</span>
                    )}
                  </button>
                </div>

                {/* Evening */}
                <div className={`border-2 rounded-lg p-3 transition-all ${getSlotColor(daySchedule.evening)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-sm">Evening</span>
                    </div>
                    {daySchedule.evening?.person && (
                      <button
                        onClick={() => handleCompleteToggle(dateKey, 'evening')}
                        className="p-1 rounded-full hover:bg-gray-200 transition-all"
                        title="Mark as completed"
                      >
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            daySchedule.evening.completed
                              ? 'bg-green-500 border-green-500'
                              : 'bg-white border-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {daySchedule.evening.completed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    )}
                  </div>
                  <button onClick={() => handleSlotClick(dateKey, 'evening')} className="w-full text-left">
                    {daySchedule.evening?.person ? (
                      <span className={`font-medium ${getPersonColor(daySchedule.evening.person)}`}>
                        {daySchedule.evening.person}
                        {daySchedule.evening.completed && ' ✓'}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">Click to claim</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CatFeedingScheduler;