"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { CalendarApi, DatesSetArg, EventChangeArg, EventClickArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import ptBr from "@fullcalendar/core/locales/pt-br";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type ConsultationRecord,
  eventsForCalendar,
  parseEventDate,
} from "@/lib/consultations";
import {
  buildProfissionalColorMap,
  colorsForConsultationEvent,
  type ProfissionalColorLookup,
} from "@/lib/agendaProfissionalColors";
import { useMediaQuery } from "@/lib/useMediaQuery";

const SLOT_CLICK_MINUTES = 30;

export type AgendaCalendarProps = {
  events: ConsultationRecord[];
  onEventsChange: (events: ConsultationRecord[]) => void;
  /** Clique ou arraste em horário vazio — cria/atualiza evento na grade */
  onSlotSelect: (start: Date, end: Date) => void;
  onEventClick?: (event: ConsultationRecord) => void;
  profissionais?: ProfissionalColorLookup[];
  titularNome?: string | null;
  /** Minutos ao clicar slot vazio; null = 30 min só na grade (fim manual no modal) */
  defaultSlotMinutes?: number | null;
};

function endFromStart(start: Date, minutes = SLOT_CLICK_MINUTES): Date {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + minutes);
  return end;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function eventsOnDay(events: ConsultationRecord[], day: Date): ConsultationRecord[] {
  return events.filter((ev) => {
    const start = parseEventDate(ev.start);
    return start ? isSameDay(start, day) : false;
  });
}

/** Primeiro dia com eventos: hoje se houver, senão próximo futuro, senão mais recente no passado. */
export function pickAnchorDate(events: ConsultationRecord[]): Date {
  const today = startOfDay(new Date());
  if (eventsOnDay(events, today).length > 0) return today;

  const dated = events
    .map((ev) => parseEventDate(ev.start))
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dated.length === 0) return today;

  const upcoming = dated.find((d) => startOfDay(d).getTime() >= today.getTime());
  return startOfDay(upcoming ?? dated[dated.length - 1]!);
}

export default function AgendaCalendar({
  events,
  onEventsChange,
  onSlotSelect,
  onEventClick,
  profissionais = [],
  titularNome = null,
  defaultSlotMinutes = null,
}: AgendaCalendarProps) {
  const isMobile = useMediaQuery(768);
  const calendarRef = useRef<FullCalendar>(null);
  const lastNavigatedRef = useRef<number | null>(null);

  const colorMap = useMemo(
    () =>
      profissionais.length > 0
        ? buildProfissionalColorMap(profissionais, titularNome)
        : null,
    [profissionais, titularNome],
  );
  const colorOpts = useMemo(
    () => ({ profissionais, colorMap }),
    [profissionais, colorMap],
  );

  const displayFallbackMinutes = defaultSlotMinutes ?? SLOT_CLICK_MINUTES;

  const calendarEvents = useMemo(
    () =>
      eventsForCalendar(events, {
        profissionais,
        titularNome,
        fallbackMinutes: displayFallbackMinutes,
      }),
    [events, profissionais, titularNome, displayFallbackMinutes],
  );
  const anchorDate = useMemo(
    () => (events.length > 0 ? pickAnchorDate(events) : startOfDay(new Date())),
    [events],
  );

  const [visibleDay, setVisibleDay] = useState<Date>(() => anchorDate);
  const [currentView, setCurrentView] = useState(isMobile ? "listWeek" : "timeGridWeek");

  const visibleDayEvents = useMemo(
    () => eventsOnDay(events, visibleDay),
    [events, visibleDay],
  );

  const headerToolbar = useMemo(
    () =>
      isMobile
        ? {
            left: "prev,next",
            center: "title",
            right: "today,listWeek,timeGridDay",
          }
        : {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          },
    [isMobile],
  );

  const navigateToAnchor = useCallback(
    (api: CalendarApi) => {
      const targetMs = anchorDate.getTime();
      if (lastNavigatedRef.current === targetMs) return;
      api.gotoDate(anchorDate);
      setVisibleDay(anchorDate);
      lastNavigatedRef.current = targetMs;
    },
    [anchorDate],
  );

  useEffect(() => {
    if (!isMobile || events.length === 0) return;
    const api = calendarRef.current?.getApi();
    if (api) navigateToAnchor(api);
  }, [isMobile, events.length, anchorDate, navigateToAnchor]);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setVisibleDay(startOfDay(info.start));
    setCurrentView(info.view.type);
  }, []);

  const applySlotSelection = useCallback(
    (start: Date, end?: Date) => {
      if (end && end.getTime() > start.getTime()) {
        onSlotSelect(start, end);
        return;
      }
      const slotMins = defaultSlotMinutes ?? SLOT_CLICK_MINUTES;
      onSlotSelect(start, endFromStart(start, slotMins));
    },
    [onSlotSelect, defaultSlotMinutes],
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

          const oldStart = parseEventDate(item.start);
          const oldEnd = parseEventDate(item.end);
          let newEnd: Date;

          if (updated.end) {
            newEnd = updated.end;
          } else if (oldStart && oldEnd && oldEnd.getTime() > oldStart.getTime()) {
            const durationMs = oldEnd.getTime() - oldStart.getTime();
            newEnd = new Date(updated.start!.getTime() + durationMs);
          } else {
            newEnd = endFromStart(updated.start!, displayFallbackMinutes);
          }

          return {
            ...item,
            start: updated.start!.toISOString(),
            end: newEnd.toISOString(),
          };
        }),
      );
    },
    [events, onEventsChange, displayFallbackMinutes],
  );

  const badgeLabel = isMobile
    ? calendarEvents.length === 0
      ? "0 na grade"
      : `${visibleDayEvents.length} neste dia · ${calendarEvents.length} total`
    : `${calendarEvents.length} na grade`;

  const calendarKey = isMobile
    ? `agenda-mobile-${events.length > 0 ? anchorDate.getTime() : "empty"}-${colorMap?.size ?? 0}`
    : `agenda-desktop-${colorMap?.size ?? 0}`;

  return (
    <div className="agenda-calendar-root rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-2 sm:p-4 shadow-sm min-w-0">
      <div className="mb-3 sm:mb-4 flex flex-col gap-2 rounded-2xl sm:rounded-3xl bg-[#f2fff2] p-3 sm:p-4 text-sm text-slate-700">
        <div className="min-w-0">
          <p className="font-semibold text-[#047482]">Agenda inteligente</p>
          <p className="text-slate-600 text-xs sm:text-sm">
            Toque em um horário vazio para agendar · toque no evento para editar ou excluir
            {isMobile ? " · use Lista para ver todos os agendamentos da semana" : ""}
          </p>
        </div>
        <span className="self-start inline-flex rounded-full bg-[#D9F0F2] px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#047482]">
          {badgeLabel}
        </span>
      </div>
      <div className="agenda-calendar-scroll overflow-x-auto -mx-1 px-1">
        <div className="agenda-calendar-inner min-w-0 sm:min-w-full min-h-[280px]">
          <FullCalendar
            ref={calendarRef}
            key={calendarKey}
            plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView={isMobile ? "listWeek" : "timeGridWeek"}
            initialDate={anchorDate}
            height={isMobile ? "auto" : 640}
            contentHeight={isMobile && currentView === "timeGridDay" ? 520 : undefined}
            handleWindowResize
            headerToolbar={headerToolbar}
            datesSet={handleDatesSet}
            buttonText={{
              today: "Hoje",
              month: "Mês",
              week: "Sem.",
              day: "Dia",
              list: "Lista",
            }}
            locale={ptBr}
            firstDay={0}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            scrollTime={isMobile ? undefined : "08:00:00"}
            scrollTimeReset={false}
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
            noEventsContent="Nenhum agendamento neste período"
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

      {isMobile && currentView === "timeGridDay" && (
        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#047482]">
            {format(visibleDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          {visibleDayEvents.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Nenhum agendamento neste dia · {calendarEvents.length} no total. Use as setas ou
              &quot;Lista&quot; acima para ver outros dias.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {visibleDayEvents
                .slice()
                .sort(
                  (a, b) =>
                    (parseEventDate(a.start)?.getTime() ?? 0) -
                    (parseEventDate(b.start)?.getTime() ?? 0),
                )
                .map((ev) => {
                  const start = parseEventDate(ev.start);
                  const hora = start ? format(start, "HH:mm") : "—";
                  const profColors = colorsForConsultationEvent(ev, colorOpts);
                  return (
                    <li key={String(ev.id)}>
                      <button
                        type="button"
                        onClick={() => onEventClick?.(ev)}
                        className="w-full rounded-xl border px-3 py-2.5 text-left text-sm hover:border-[#047482] touch-manipulation"
                        style={
                          profColors
                            ? {
                                backgroundColor: profColors.background,
                                borderColor: profColors.border,
                                borderLeftWidth: 4,
                              }
                            : { borderColor: '#e2e8f0', backgroundColor: '#fff' }
                        }
                      >
                        <span className="font-semibold text-slate-900">{hora}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-slate-800">
                          {ev.patient || ev.title || "Cliente"}
                        </span>
                        {ev.medico && (
                          <span className="block text-xs text-slate-500 mt-0.5">
                            com {ev.medico}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
