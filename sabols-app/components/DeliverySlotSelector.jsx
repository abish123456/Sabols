import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Calendar as CalendarIcon, CheckCircle2, AlertCircle, ChevronDown, X } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { apiFetch } from '../lib/api';

export default function DeliverySlotSelector({ value, onChange, error }) {
  const [cutoffHour, setCutoffHour] = useState(11);
  const [cutoffMinute, setCutoffMinute] = useState(0);
  const [holidayDates, setHolidayDates] = useState(new Set());
  const [weeklyOffDays, setWeeklyOffDays] = useState(new Set());
  
  const [showPicker, setShowPicker] = useState(false);
  const [minDate, setMinDate] = useState(new Date());

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiFetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.config) {
            setCutoffHour(parseInt(data.config.SAME_DAY_CUTOFF_HOUR || 11));
            setCutoffMinute(parseInt(data.config.SAME_DAY_CUTOFF_MINUTE || 0));
            if (Array.isArray(data.config.holidays)) {
              setHolidayDates(new Set(data.config.holidays.map(h => h.date)));
            }
            if (Array.isArray(data.config.HOLIDAY_WEEKDAYS)) {
              setWeeklyOffDays(new Set(data.config.HOLIDAY_WEEKDAYS));
            }
          }
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };
    fetchConfig();
  }, []);

  // Determine the minimum selectable date
  useEffect(() => {
    const now = new Date();
    const istFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = istFormatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    const isPastCutoff = currentHour > cutoffHour || (currentHour === cutoffHour && currentMinute >= cutoffMinute);

    let targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (isPastCutoff ? 2 : 1));
    targetDate.setHours(0, 0, 0, 0);

    // Helper: YYYY-MM-DD in IST
    const toISTStr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    
    // Helper: IST weekday index (0=Sun … 6=Sat)
    const getISTWeekday = (d) => {
      const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(d);
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
    };

    // Roll forward until we land on a working day
    for (let i = 0; i < 60; i++) {
      const dateStr = toISTStr(targetDate);
      const weekday = getISTWeekday(targetDate);
      if (!holidayDates.has(dateStr) && !weeklyOffDays.has(weekday)) break;
      targetDate.setDate(targetDate.getDate() + 1);
    }

    setMinDate(targetDate);
    
    // Always validate the current value to ensure it's not a holiday
    const currentDate = value ? new Date(value) : targetDate;
    const dateStr = toISTStr(currentDate);
    const weekday = getISTWeekday(currentDate);
    
    // If the current value is a holiday (or not set), reset to targetDate
    if (!value || holidayDates.has(dateStr) || weeklyOffDays.has(weekday)) {
      onChange(toISTStr(targetDate));
    }
  }, [cutoffHour, cutoffMinute, holidayDates, weeklyOffDays]);

  // Generate markedDates for the calendar to visually disable holidays
  const markedDates = React.useMemo(() => {
    const dates = {};
    const toISTStr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const getISTWeekday = (d) => {
      const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(d);
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
    };

    let tempDate = new Date(minDate);
    for (let i = 0; i < 60; i++) {
      const dateStr = toISTStr(tempDate);
      const weekday = getISTWeekday(tempDate);

      if (holidayDates.has(dateStr) || weeklyOffDays.has(weekday)) {
        dates[dateStr] = {
          disabled: true,
          disableTouchEvent: true,
        };
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    if (value) {
      dates[value] = {
        ...dates[value],
        selected: true,
        selectedColor: '#0ea5e9',
      };
    }

    return dates;
  }, [value, minDate, holidayDates, weeklyOffDays]);

  const handleDayPress = (day) => {
    if (markedDates[day.dateString]?.disabled) {
      return;
    }
    onChange(day.dateString);
    setShowPicker(false);
  };

  const getFormattedDate = () => {
    if (!value) return "Pick a date";
    try {
      const date = new Date(value);
      return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    } catch {
      return value;
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CalendarIcon size={18} color="#0ea5e9" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Select Delivery Date</Text>
        </View>
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AlertCircle size={14} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '500' }}>{error}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity 
        onPress={() => setShowPicker(true)}
        style={{ paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text style={{ color: '#1f2937', fontWeight: '600' }}>{getFormattedDate()}</Text>
        <ChevronDown size={20} color="#9ca3af" />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>Select Delivery Date</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              minDate={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(minDate)}
              maxDate={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(new Date().setDate(new Date().getDate() + 30)))}
              onDayPress={handleDayPress}
              markedDates={markedDates}
              theme={{
                todayTextColor: '#0ea5e9',
                selectedDayBackgroundColor: '#0ea5e9',
                arrowColor: '#0ea5e9',
                textDisabledColor: '#d1d5db',
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
