"use client";

import { useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventChangeArg, EventClickArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import ptBr from "@fullcalendar/core/locales/pt-br";
import {
  type ConsultationRecord,
  eventsForCalendar,
} from "@/lib/consultations";
import { useMediaQuery } from "@/lib/useMediaQuery";

const DEFAULT_SLOT_MINUTES = 40;

export type AgendaCalendarProps = {
  events: ConsultationRecord[];
  onEventsChange: (events: ConsultationRecord[]) => void;
  /** Clique ou arraste em horário vazio — cria/atualiza evento na grade */
  onSlotSelect: (start: Date, end: Date) => void;
  onEventClick?: (event: ConsultationRecord) => void;
};

function endFromStart(start: Date, minutes = DEFAULT_SLOT_MINUTES): Date {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + minutes);
  return end;
}

export default function AgendaCalendar({
  events,
  onEventsChange,
  onSlotSelect,
  onEventClick,
}: AgendaCalendarProps) {
  const isMobile = useMediaQuery(768);
  const calendarEvents = useMemo(() => eventsForCalendar(events), [events]);

  const headerToolbar = useMemo(
    () =>
      isMobile
        ? {
            left: "prev,next",
            center: "title",
            right: "today,timeGridDay,timeGridWeek",
          }
        : {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          },
    [isMobile],
  );

  const applySlotSelection = useCallback(
    (start: Date, end?: Date) => {
      const endDate =
        end && end.getTime() > start.getTime() ? end : endFromStart(start);
      onSlotSelect(start, endDate);
    },
    [onSlotSelect],
  );

  const handleDateClick = useCallback(
    (clickInfo: DateClickArg) => {
      const start = new Date(clickInfo.date);
      if (clickInfo.allDay) {
        start.setHours(8, 0, 0, 0);
      }
      applySlotSelection(start);
    },
    [applySlotSelection],
  );

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const id = clickInfo.event.id;
      const found = events.find((e) => String(e.id) === String(id));
      if (found && onEventClick) {
        onEventClick(found);
      }
    },
    [events, onEventClick],
  );

  const handleEventChange = useCallback(
    (changeInfo: EventChangeArg) => {
      const updated = changeInfo.event;
      if (!updated.id || !updated.start) return;

      onEventsChange(
        events.map((item) => {
          if (String(item.id) !== String(updated.id)) return item;
          const endAt = updated.end ?? updated.start!;
          return {
            ...item,
            start: updated.start!.toISOString(),
            end: endAt.toISOString(),
          };
        }),
      );
    },
    [events, onEventsChange],
  );

  return (
    <div className="agenda-calendar-root rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-2 sm:p-4 shadow-sm min-w-0">
      <div className="mb-3 sm:mb-4 flex flex-col gap-2 rounded-2xl sm:rounded-3xl bg-[#f2fff2] p-3 sm:p-4 text-sm text-slate-700">
        <div className="min-w-0">
          <p className="font-semibold text-[#2d652d]">Agenda inteligente</p>
          <p className="text-slate-600 text-xs sm:text-sm">
            Toque em um horário vazio para agendar · toque no evento para editar ou excluir
          </p>
        </div>
        <span className="self-start inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#2d652d]">
          {calendarEvents.length} na grade
        </span>
      </div>
      <div className="agenda-calendar-scroll overflow-x-auto -mx-1 px-1 touch-pan-x">
        <div className="agenda-calendar-inner min-w-0 sm:min-w-full">
          <FullCalendar
            plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin]}
            initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
            height={isMobile ? "auto" : 640}
            contentHeight={isMobile ? 520 : undefined}
            handleWindowResize
            headerToolbar={headerToolbar}
            buttonText={{
              today: "Hoje",
              month: "Mês",
              week: "Sem.",
              day: "Dia",
            }}
            locale={ptBr}
            firstDay={0}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            allDaySlot={false}
            nowIndicator
            selectable={false}
            dateClick={handleDateClick}
            editable
            eventStartEditable
            eventDurationEditable
            dayMaxEvents
            weekends
            events={calendarEvents}
            eventClick={handleEventClick}
            eventChange={handleEventChange}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            slotLabelFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
