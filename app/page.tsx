"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { format, addMinutes, parseISO, setHours, setMinutes, differenceInMinutes } from "date-fns";
import { ko } from "date-fns/locale";
import { 
  CalendarIcon, Clock, User, MessageSquare, 
  X, Check, Plus, CalendarDays, Lock, Trash2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROOMS = ["4층 Black", "3층 Purple", "2층 Violet", "1층 Magenta", "B층 소회의 Gray", "B층 대회의 White"];
const START_HOUR = 7;
const END_HOUR = 21.5;
const SLOT_HEIGHT = 90; // 한 슬롯(30분)의 높이를 고정합니다.

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

  const [userName, setUserName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState(""); 
  const [deletePassword, setDeletePassword] = useState(""); 

  useEffect(() => { setMounted(true); fetchReservations(); }, [selectedDate, activeTab]);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("room_name", activeTab)
      .gte("start_time", `${selectedDate}T00:00:00`)
      .lte("start_time", `${selectedDate}T23:59:59`);
    if (!error) setReservations(data || []);
  };

  const handleReserve = async () => {
    if (!userName || !startTime || !endTime || !password) return alert("모든 정보를 입력해주세요.");
    if (startTime >= endTime) return alert("종료 시간을 확인해주세요.");

    setIsSubmitting(true);
    const newS = new Date(`${selectedDate}T${startTime}:00`).getTime();
    const newE = new Date(`${selectedDate}T${endTime}:00`).getTime();
    
    const overlap = reservations.some(res => 
      newS < new Date(res.end_time).getTime() && newE > new Date(res.start_time).getTime()
    );

    if (overlap) {
      alert("⚠️ 이미 예약된 시간입니다.");
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
      alert("VinylC 예약 완료");
      setIsSheetOpen(false);
      resetForm();
      fetchReservations();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deletePassword) return alert("비밀번호를 입력하세요.");
    if (viewDetail.password !== deletePassword) return alert("비밀번호 불일치");
    if (!confirm("정말 취소하시겠습니까?")) return;

    const { error } = await supabase.from("reservations").delete().eq("id", viewDetail.id).select();
    if (!error) {
      setReservations(prev => prev.filter(res => res.id !== viewDetail.id));
      alert("취소되었습니다.");
      setViewDetail(null);
    }
  };

  const resetForm = () => {
    setUserName(""); setStartTime(""); setEndTime(""); setDescription(""); setPassword(""); setDeletePassword("");
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-white text-black font-sans pb-20">
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

      {/* Timeline Grid */}
      <div className="p-6 space-y-0 relative">
        {TIME_OPTIONS.map((time, idx) => {
          const res = reservations.find(r => r.start_time.split('T')[1].substring(0,5) === time);
          const isBusy = reservations.some(r => {
            const s = r.start_time.split('T')[1].substring(0,5);
            const e = r.end_time.split('T')[1].substring(0,5);
            return time >= s && time < e;
          });

          // 예약 카드의 높이 계산
          let cardHeight = SLOT_HEIGHT;
          if (res) {
            const duration = differenceInMinutes(parseISO(res.end_time), parseISO(res.start_time));
            cardHeight = (duration / 30) * SLOT_HEIGHT - 4; // 4px는 마진 보정
          }

          return (
            <div key={time} style={{ height: `${SLOT_HEIGHT}px` }} className="flex gap-4 relative">
              <div className="w-10 pt-2 text-[10px] font-black text-gray-300 tabular-nums">{time}</div>
              <div className="flex-1 border-t border-gray-50 relative">
                {res && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} 
                    onClick={() => setViewDetail(res)} 
                    className="absolute inset-x-0 top-1 z-10 bg-black text-white rounded-2xl p-4 shadow-2xl cursor-pointer border-l-[6px] border-indigo-500 overflow-hidden" 
                    style={{ height: `${cardHeight}px` }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-black tracking-tight">{res.user_name}</span>
                      <span className="text-[9px] font-bold opacity-50 uppercase">{res.start_time.split('T')[1].substring(0,5)} - {res.end_time.split('T')[1].substring(0,5)}</span>
                    </div>
                    {cardHeight > 50 && (
                      <p className="text-[11px] opacity-70 font-medium line-clamp-2">{res.description || "회의 주제 없음"}</p>
                    )}
                  </motion.div>
                )}
                {!isBusy && (
                  <button onClick={() => { resetForm(); setStartTime(time); setEndTime(TIME_OPTIONS[idx+1] || "22:00"); setIsSheetOpen(true); }} className="w-full h-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"><Plus size={16} className="text-gray-100" /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sheet UI 생략 (동일함) */}
      <AnimatePresence>
        {/* ... (기존 Bottom Sheet 코드 동일하게 유지) ... */}
        {isSheetOpen || viewDetail ? (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsSheetOpen(false); setViewDetail(null); resetForm(); }} className="fixed inset-0 bg-black/70 backdrop-blur-md z-[50]" />
        ) : null}
        {isSheetOpen && (
           <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[3rem] p-10 max-w-md mx-auto shadow-2xl">
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-10" />
              <div className="space-y-6">
                  <header><h2 className="text-4xl font-black italic tracking-tighter">VinylC</h2><p className="text-gray-400 text-[10px] font-black mt-2 uppercase tracking-widest">{activeTab} 예약</p></header>
                  <div className="space-y-5">
                    <div className="border-b-2 border-gray-100 py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Name</p><input type="text" placeholder="성함" value={userName} onChange={e => setUserName(e.target.value)} className="w-full h-10 bg-white outline-none font-black text-xl" /></div>
                    <div className="flex gap-6">
                      <div className="flex-1 border-b-2 border-gray-100 py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Start</p><select value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full h-10 bg-white outline-none font-black text-xl">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div className="flex-1 border-b-2 border-gray-100 py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">End</p><select value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full h-10 bg-white outline-none font-black text-xl">{TIME_OPTIONS.concat("22:00").map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div className="border-b-2 border-gray-100 focus-within:border-black py-2"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Password (4 Digits)</p><input type="tel" maxLength={4} placeholder="숫자 4자리" value={password} onChange={e => setPassword(e.target.value.replace(/[^0-9]/g, ""))} className="w-full h-10 bg-white outline-none font-black text-xl tracking-[0.5em]" /></div>
                    <div className="border-b-2 border-gray-100 py-2"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full outline-none font-black text-lg resize-none" placeholder="회의 주제" /></div>
                  </div>
                  <button onClick={handleReserve} disabled={isSubmitting} className="w-full h-16 rounded-2xl font-black text-white bg-black active:scale-95 transition-all text-sm uppercase">{isSubmitting ? "Wait..." : "Confirm Reservation"}</button>
              </div>
           </motion.div>
        )}
        {viewDetail && (
           <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[3rem] p-10 max-w-md mx-auto shadow-2xl">
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-10" />
              <div className="space-y-8">
                  <header className="flex justify-between items-start"><div><h2 className="text-4xl font-black italic tracking-tighter uppercase">Detail.</h2><p className="text-gray-400 text-[10px] font-black mt-2 uppercase tracking-widest">{viewDetail.room_name}</p></div><button onClick={() => setViewDetail(null)} className="p-3 bg-gray-50 rounded-full text-gray-400"><X size={20}/></button></header>
                  <div className="space-y-6">
                    <div className="flex items-center gap-6"><div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center font-black italic text-xs tracking-tighter">Who</div><div><p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mb-1">User</p><p className="font-black text-2xl tracking-tight">{viewDetail.user_name}</p></div></div>
                    <div className="flex items-center gap-6"><div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center font-black italic text-xs tracking-tighter">Time</div><div><p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mb-1">Schedule</p><p className="font-black text-2xl tracking-tight">{viewDetail.start_time.split('T')[1].substring(0,5)} — {viewDetail.end_time.split('T')[1].substring(0,5)}</p></div></div>
                    <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100"><p className="text-[10px] text-gray-300 font-bold uppercase mb-2">Subject</p><p className="font-bold text-gray-800 text-lg leading-snug">{viewDetail.description || "등록된 내용 없음"}</p></div>
                  </div>
                  <div className="pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-4 mb-4"><Lock size={16} className="text-gray-300"/><input type="tel" maxLength={4} placeholder="비밀번호" value={deletePassword} onChange={e => setDeletePassword(e.target.value.replace(/[^0-9]/g, ""))} className="flex-1 outline-none font-black text-sm border-b border-gray-100 focus:border-black py-2" /></div>
                    <button onClick={handleDelete} className="w-full h-14 bg-white border-2 border-black text-black rounded-2xl font-black text-xs uppercase hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"><Trash2 size={16}/> Delete</button>
                  </div>
              </div>
           </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}