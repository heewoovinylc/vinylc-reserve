"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { format, addMinutes, parseISO, setHours, setMinutes } from "date-fns";
import { ko } from "date-fns/locale";
import { 
  CalendarIcon, Clock, User, MessageSquare, 
  X, Check, Plus, CalendarDays, Lock, Trash2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Supabase 설정 ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROOMS = ["4층 Black", "3층 Purple", "2층 Violet", "1층 Magenta", "B층 소회의 Gray", "B층 대회의 White"];
const START_HOUR = 7;
const END_HOUR = 21.5;

const TIME_OPTIONS: string[] = [];
for (let h = START_HOUR; h <= END_HOUR; h += 0.5) {
  const hour = Math.floor(h).toString().padStart(2, "0");
  const min = h % 1 === 0 ? "00" : "30";
  TIME_OPTIONS.push(`${hour}:${min}`);
}

export default function VinylCApp() {
  const [mounted, setMounted] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState(ROOMS[0]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 필드 상태
  const [userName, setUserName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState(""); 
  const [deletePassword, setDeletePassword] = useState(""); 

  useEffect(() => { 
    setMounted(true); 
    fetchReservations(); 
  }, [selectedDate, activeTab]);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("room_name", activeTab)
      .gte("start_time", `${selectedDate}T00:00:00`)
      .lte("start_time", `${selectedDate}T23:59:59`);
    if (!error) setReservations(data || []);
  };

  const validatePassword = (pw: string) => /^\d{4}$/.test(pw);

  // 예약 핸들러 (중복 체크 강화)
  const handleReserve = async () => {
    if (!userName || !startTime || !endTime || !password) return alert("모든 정보를 입력해주세요.");
    if (!validatePassword(password)) return alert("비밀번호는 숫자 4자리로 설정해주세요.");
    if (startTime >= endTime) return alert("종료 시간은 시작 시간보다 늦어야 합니다.");

    setIsSubmitting(true);
    
    // 최종 중복 체크
    const newS = new Date(`${selectedDate}T${startTime}:00`).getTime();
    const newE = new Date(`${selectedDate}T${endTime}:00`).getTime();
    const overlap = reservations.some(res => 
      newS < new Date(res.end_time).getTime() && newE > new Date(res.start_time).getTime()
    );

    if (overlap) {
      alert("⚠️ 이미 예약된 시간입니다. 타임라인을 확인해주세요.");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("reservations").insert([{
      room_name: activeTab, user_name: userName,
      start_time: `${selectedDate}T${startTime}:00`,
      end_time: `${selectedDate}T${endTime}:00`,
      description, password 
    }]);

    if (!error) {
      alert("VinylC 예약이 완료되었습니다.");
      setIsSheetOpen(false);
      resetForm();
      fetchReservations();
    }
    setIsSubmitting(false);
  };

  // 삭제 핸들러 (실제 삭제 여부 확인 강화)
  const handleDelete = async () => {
    if (!deletePassword) return alert("삭제 비밀번호 4자리를 입력하세요.");
    if (viewDetail.password !== deletePassword) return alert("비밀번호가 일치하지 않습니다.");
    if (!confirm("정말 이 예약을 취소하시겠습니까?")) return;

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("reservations")
      .delete()
      .eq("id", viewDetail.id)
      .select(); // 삭제된 데이터를 반환받아 실제 삭제 확인

    if (error || !data || data.length === 0) {
      alert("⚠️ 삭제 권한이 없거나 이미 삭제된 예약입니다. (Supabase RLS 설정을 확인하세요)");
    } else {
      setReservations(prev => prev.filter(res => res.id !== viewDetail.id));
      alert("예약이 정상적으로 취소되었습니다.");
      setViewDetail(null);
      setDeletePassword("");
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setUserName(""); setStartTime(""); setEndTime(""); setDescription(""); setPassword(""); setDeletePassword("");
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-white text-black font-sans pb-20 selection:bg-black selection:text-white">
      {/* VinylC Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-5 flex justify-between items-center">
        <h1 className="text-2xl font-black italic tracking-tighter">VinylC</h1>
        <button onClick={() => { resetForm(); setIsSheetOpen(true); }} className="bg-black text-white px-5 py-2.5 rounded-full text-xs font-black active:scale-95 transition-all">예약하기</button>
      </header>

      {/* Date & Tabs */}
      <div className="sticky top-[73px] z-30 bg-white border-b border-gray-100 pt-4 shadow-sm">
        <div className="px-6 mb-4 flex items-center gap-3">
          <CalendarDays size={18} className="text-gray-400" />
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="font-black text-sm outline-none bg-gray-50 px-3 py-2 rounded-xl border border-gray-100" />
        </div>
        <div className="flex overflow-x-auto no-scrollbar px-6 gap-6 scroll-smooth">
          {ROOMS.map(room => (
            <button key={room} onClick={() => setActiveTab(room)} className={`pb-3 text-sm font-black whitespace-nowrap border-b-3 transition-all ${activeTab === room ? "border-black text-black" : "border-transparent text-gray-200"}`}>{room}</button>
          ))}
        </div>
      </div>

      {/* Timeline List */}
      <div className="p-6 space-y-0 relative">
        {TIME_OPTIONS.map((time, idx) => {
          const res = reservations.find(r => r.start_time.split('T')[1].substring(0,5) === time);
          const isBusy = reservations.some(r => {
            const s = r.start_time.split('T')[1].substring(0,5);
            const e = r.end_time.split('T')[1].substring(0,5);
            return time >= s && time < e;
          });

          return (
            <div key={time} className="flex gap-4 min-h-[85px] relative">
              <div className="w-10 pt-2 text-[10px] font-black text-gray-300 tabular-nums">{time}</div>
              <div className="flex-1 border-t border-gray-50 relative py-2">
                {res && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    onClick={() => setViewDetail(res)} 
                    className="absolute inset-x-0 top-1 z-10 bg-black text-white rounded-2xl p-4 shadow-2xl cursor-pointer border-l-[6px] border-blue-500 overflow-hidden" 
                    style={{ minHeight: '75px' }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-black tracking-tight">{res.user_name}</span>
                      <span className="text-[9px] font-bold opacity-50 uppercase tracking-tighter">
                        {res.start_time.split('T')[1].substring(0,5)} - {res.end_time.split('T')[1].substring(0,5)}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-70 font-medium line-clamp-1">{res.description || "회의 내용 없음"}</p>
                  </motion.div>
                )}
                {!isBusy && (
                  <button 
                    onClick={() => { resetForm(); setStartTime(time); setEndTime(TIME_OPTIONS[idx+1] || "22:00"); setIsSheetOpen(true); }} 
                    className="w-full h-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Plus size={16} className="text-gray-100" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sheets (Booking & Details) */}
      <AnimatePresence>
        {(isSheetOpen || viewDetail) && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsSheetOpen(false); setViewDetail(null); resetForm(); }} className="fixed inset-0 bg-black/70 backdrop-blur-md z-[50]" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[3.5rem] p-10 max-w-md mx-auto shadow-2xl">
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-10" />
              
              {isSheetOpen ? (
                <div className="space-y-6">
                  <header><h2 className="text-4xl font-black italic tracking-tighter">VinylC</h2><p className="text-gray-400 text-[10px] font-black mt-2 uppercase tracking-widest">{activeTab} 예약 시스템</p></header>
                  <div className="space-y-5 pt-4">
                    <div className="border-b-2 border-gray-100 focus-within:border-black py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Name</p><input type="text" placeholder="성함" value={userName} onChange={e => setUserName(e.target.value)} className="w-full h-10 bg-white outline-none font-black text-xl" /></div>
                    <div className="flex gap-6">
                      <div className="flex-1 border-b-2 border-gray-100 focus-within:border-black py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Start</p><select value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full h-10 bg-white outline-none font-black text-xl">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div className="flex-1 border-b-2 border-gray-100 focus-within:border-black py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">End</p><select value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full h-10 bg-white outline-none font-black text-xl">{TIME_OPTIONS.concat("22:00").map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div className="border-b-2 border-gray-100 focus-within:border-black py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Pass (4 Digits)</p><input type="tel" maxLength={4} placeholder="숫자 4자리" value={password} onChange={e => setPassword(e.target.value.replace(/[^0-9]/g, ""))} className="w-full h-10 bg-white outline-none font-black text-xl tracking-[0.5em]" /></div>
                    <div className="border-b-2 border-gray-100 py-2"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full outline-none font-black text-lg resize-none" placeholder="회의 내용을 입력하세요" /></div>
                  </div>
                  <button onClick={handleReserve} disabled={isSubmitting} className="w-full h-18 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all disabled:bg-gray-200 mt-6">{isSubmitting ? "Processing..." : "Confirm Booking"}</button>
                </div>
              ) : (
                <div className="space-y-8">
                  <header className="flex justify-between items-start"><div><h2 className="text-4xl font-black italic tracking-tighter uppercase">Detail.</h2><p className="text-gray-400 text-[10px] font-black mt-2 uppercase tracking-widest">{viewDetail.room_name}</p></div><button onClick={() => setViewDetail(null)} className="p-3 bg-gray-50 rounded-full text-gray-400"><X size={20}/></button></header>
                  <div className="space-y-6">
                    <div className="flex items-center gap-6"><div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center font-black italic text-xs tracking-tighter shadow-lg shadow-black/20">Who</div><div><p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mb-1">User</p><p className="font-black text-2xl tracking-tight">{viewDetail.user_name}</p></div></div>
                    <div className="flex items-center gap-6"><div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center font-black italic text-xs tracking-tighter">Time</div><div><p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mb-1">Schedule</p><p className="font-black text-2xl tracking-tight">{viewDetail.start_time.split('T')[1].substring(0,5)} — {viewDetail.end_time.split('T')[1].substring(0,5)}</p></div></div>
                    <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 leading-relaxed"><p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mb-3">Meeting Purpose</p><p className="font-bold text-gray-800 text-lg">{viewDetail.description || "등록된 내용이 없습니다."}</p></div>
                  </div>
                  <div className="pt-8 border-t border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                      <Lock size={16} className="text-gray-300"/>
                      <input type="tel" maxLength={4} placeholder="비밀번호 4자리 입력" value={deletePassword} onChange={e => setDeletePassword(e.target.value.replace(/[^0-9]/g, ""))} className="flex-1 outline-none font-black text-sm border-b border-gray-100 focus:border-black py-2 tracking-widest" />
                    </div>
                    <button onClick={handleDelete} disabled={isSubmitting} className="w-full h-16 bg-white border-2 border-black text-black rounded-2xl font-black text-xs uppercase hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"><Trash2 size={16}/> Delete Reservation</button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}