"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { CalendarApi, DatesSetArg, EventChangeArg, EventClickArg, EventContentArg } from "@fullcalendar/core";
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
import type { AgendaSyncHealth } from "@/lib/agendaSyncHealth";
import { inferSyncHealth } from "@/lib/agendaSyncHealthUi";
import AgendaSyncHealthBadge from "@/components/AgendaSyncHealthBadge";
import {
  buildProfissionalColorMap,
  colorsForConsultationEvent,
  type ProfissionalColorLookup,
} from "@/lib/agendaProfissionalColors";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useDismissableLayer } from "@/lib/useDismissableLayer";

const SLOT_CLICK_MINUTES = 30;

export type AgendaCalendarProps = {
  events: ConsultationRecord[];
  onEventsChange: (events: ConsultationRecord[]) => void;
  /** Clique ou arraste em horário vazio — cria/atualiza evento na grade */
  onSlotSelect: (start: Date, end: Date) => void;
  onEventClick?: (event: ConsultationRecord) => void;
  /** Reenviar outbox Google de uma sessão (badge vermelho). */
  onRetryGoogleOutbox?: (consultaId: string) => void;
  /** Reabrir o modal de conflito de horário. */
  onReviewTimeConflict?: (event: ConsultationRecord) => void;
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
  onRetryGoogleOutbox,
  onReviewTimeConflict,
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
  /** Desktop dayGridMonth: lista do dia (estilo Google), sem abrir “nova sessão”. */
  const [monthDayPopover, setMonthDayPopover] = useState<Date | null>(null);
  const monthPopoverRootRef = useRef<HTMLDivElement>(null);
  const monthPopoverPanelRef = useRef<HTMLDivElement>(null);

  const visibleDayEvents = useMemo(
    () => eventsOnDay(events, visibleDay),
    [events, visibleDay],
  );

  const monthPopoverEvents = useMemo(
    () => (monthDayPopover ? eventsOnDay(events, monthDayPopover) : []),
    [events, monthDayPopover],
  );

  const closeMonthDayPopover = useCallback(() => setMonthDayPopover(null), []);

  const openMonthDayPopover = useCallback((day: Date) => {
    setMonthDayPopover(startOfDay(day));
  }, []);

  const { markJustOpened: markMonthPopoverOpened } = useDismissableLayer({
    open: monthDayPopover != null,
    onClose: closeMonthDayPopover,
    rootRef: monthPopoverRootRef,
    floatingRef: monthPopoverPanelRef,
  });

  useEffect(() => {
    if (!monthDayPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMonthDayPopover();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monthDayPopover, closeMonthDayPopover]);

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
    if (info.view.type !== "dayGridMonth") {
      setMonthDayPopover(null);
    }
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
      const viewType = clickInfo.view.type || currentView;
      if (!isMobile && viewType === "dayGridMonth") {
        openMonthDayPopover(clickInfo.date);
        markMonthPopoverOpened();
        return;
      }
      const start = new Date(clickInfo.date);
      if (clickInfo.allDay) {
        start.setHours(8, 0, 0, 0);
      }
      applySlotSelection(start);
    },
    [
      applySlotSelection,
      currentView,
      isMobile,
      markMonthPopoverOpened,
      openMonthDayPopover,
    ],
  );

  const handleMoreLinkClick = useCallback(
    (arg: { date: Date }) => {
      if (!isMobile) {
        openMonthDayPopover(arg.date);
        markMonthPopoverOpened();
      }
      // FullCalendar trata retorno falsy como "popover" nativo; valor truthy não-string suprime.
      return true as unknown as void;
    },
    [isMobile, markMonthPopoverOpened, openMonthDayPopover],
  );

  const handleNewSessionFromMonthPopover = useCallback(() => {
    if (!monthDayPopover) return;
    const start = new Date(monthDayPopover);
    start.setHours(8, 0, 0, 0);
    closeMonthDayPopover();
    applySlotSelection(start);
  }, [monthDayPopover, closeMonthDayPopover, applySlotSelection]);

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const id = clickInfo.event.id;
      const found = events.find((e) => String(e.id) === String(id));
      if (found && onEventClick) {
        closeMonthDayPopover();
        onEventClick(found);
      }
    },
    [events, onEventClick, closeMonthDayPopover],
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

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const syncHealth = arg.event.extendedProps.syncHealth as AgendaSyncHealth | undefined;
    const found = events.find((e) => String(e.id) === String(arg.event.id));
    const health =
      syncHealth ?? (found ? inferSyncHealth(found) : undefined);
    const patient =
      (arg.event.extendedProps.patient as string | undefined)?.trim() ||
      found?.patient?.trim() ||
      "";
    const service =
      (arg.event.extendedProps.service as string | undefined)?.trim() ||
      found?.service?.trim() ||
      "";
    const observacoes = found?.observacoes?.trim() || "";
    const displayPatient = patient && patient.toLowerCase() !== "cliente" ? patient : arg.event.title;
    const isMonth = arg.view.type === "dayGridMonth";
    const startDate = arg.event.start;
    const timeLabel =
      arg.timeText?.trim() ||
      (startDate ? format(startDate, "HH:mm") : "");

    if (isMonth) {
      return (
        <div className="relative min-w-0 leading-tight overflow-hidden">
          <div className="fc-event-title min-w-0 truncate text-[10px] sm:text-[11px] font-semibold">
            {timeLabel ? (
              <>
                <span className="tabular-nums opacity-90">{timeLabel}</span>
                <span className="mx-0.5 opacity-60"> </span>
              </>
            ) : null}
            <span>{displayPatient}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-w-0 pr-4 leading-tight">
        {health ? (
          <span className="absolute right-0 top-0">
            <AgendaSyncHealthBadge
              health={health}
              googleOutbox={found?.googleOutbox ?? null}
              compact
              onRetry={
                found?.googleOutbox === "error" && found?.id
                  ? () => onRetryGoogleOutbox?.(String(found.id))
                  : undefined
              }
              onReview={
                health === "needs_review" && found && onReviewTimeConflict
                  ? () => onReviewTimeConflict(found)
                  : undefined
              }
            />
          </span>
        ) : null}
        <div className="fc-event-title min-w-0 truncate font-semibold text-[11px] sm:text-xs">
          {displayPatient}
        </div>
        {service && service.toLowerCase() !== "atendimento" ? (
          <div className="min-w-0 truncate text-[10px] opacity-80">{service}</div>
        ) : null}
        {observacoes ? (
          <div className="min-w-0 truncate text-[10px] italic opacity-75">{observacoes}</div>
        ) : null}
      </div>
    );
  }, [events, onRetryGoogleOutbox, onReviewTimeConflict]);

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
            {isMobile
              ? "Toque em um horário vazio para agendar · toque no evento para editar ou excluir · use Lista para ver todos os agendamentos da semana"
              : currentView === "dayGridMonth"
                ? "No mês, clique no dia para ver os horários · clique no evento para editar · use Nova sessão no painel do dia"
                : "Toque em um horário vazio para agendar · toque no evento para editar ou excluir"}
          </p>
        </div>
        <span className="self-start inline-flex rounded-full bg-[#D9F0F2] px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#047482]">
          {badgeLabel}
        </span>
      </div>
      <div
        ref={monthPopoverRootRef}
        className="agenda-calendar-scroll overflow-x-auto -mx-1 px-1 relative"
      >
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
            moreLinkClick={handleMoreLinkClick}
            displayEventTime
            displayEventEnd={false}
            weekends
            events={calendarEvents}
            eventContent={renderEventContent}
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

        {monthDayPopover && !isMobile ? (
          <div
            className="absolute inset-0 z-30 flex items-start justify-center bg-slate-900/25 p-3 sm:p-4 pt-16 sm:pt-20"
            role="presentation"
            onClick={closeMonthDayPopover}
          >
            <div
              ref={monthPopoverPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Agendamentos de ${format(monthDayPopover, "d 'de' MMMM", { locale: ptBR })}`}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[min(420px,70vh)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#047482]">
                    {format(monthDayPopover, "EEEE", { locale: ptBR })}
                  </p>
                  <p className="text-base font-semibold text-slate-900 capitalize">
                    {format(monthDayPopover, "d 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMonthDayPopover}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Fechar"
                >
                  Fechar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {monthPopoverEvents.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-slate-500">
                    Nenhuma sessão neste dia.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {monthPopoverEvents
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
                        const health = inferSyncHealth(ev);
                        return (
                          <li key={String(ev.id)}>
                            <button
                              type="button"
                              onClick={() => {
                                closeMonthDayPopover();
                                onEventClick?.(ev);
                              }}
                              className="w-full rounded-xl border px-3 py-2.5 text-left text-sm hover:border-[#047482] touch-manipulation"
                              style={
                                profColors
                                  ? {
                                      backgroundColor: profColors.background,
                                      borderColor: profColors.border,
                                      borderLeftWidth: 4,
                                    }
                                  : { borderColor: "#e2e8f0", backgroundColor: "#fff" }
                              }
                            >
                              <span className="flex items-start gap-2 min-w-0">
                                <AgendaSyncHealthBadge
                                  health={health}
                                  googleOutbox={ev.googleOutbox ?? null}
                                  compact
                                  className="mt-0.5"
                                  onRetry={
                                    ev.googleOutbox === "error"
                                      ? () => onRetryGoogleOutbox?.(String(ev.id))
                                      : undefined
                                  }
                                  onReview={
                                    health === "needs_review" && onReviewTimeConflict
                                      ? () => onReviewTimeConflict(ev)
                                      : undefined
                                  }
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="font-semibold tabular-nums text-slate-900">
                                    {hora}
                                  </span>
                                  <span className="mx-1.5 text-slate-400">·</span>
                                  <span className="text-slate-800">
                                    {ev.patient || ev.title || "Cliente"}
                                  </span>
                                  {ev.medico ? (
                                    <span className="block text-xs text-slate-500 mt-0.5">
                                      com {ev.medico}
                                    </span>
                                  ) : null}
                                  {ev.service &&
                                  ev.service.toLowerCase() !== "atendimento" ? (
                                    <span className="block text-xs text-slate-500 mt-0.5 truncate">
                                      {ev.service}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>

              <div className="border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={handleNewSessionFromMonthPopover}
                  className="w-full rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#036070] touch-manipulation"
                >
                  Nova sessão
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
                  const health = inferSyncHealth(ev);
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
                        <span className="flex items-start gap-2 min-w-0">
                          <AgendaSyncHealthBadge
                            health={health}
                            googleOutbox={ev.googleOutbox ?? null}
                            compact
                            className="mt-0.5"
                            onRetry={
                              ev.googleOutbox === "error"
                                ? () => onRetryGoogleOutbox?.(String(ev.id))
                                : undefined
                            }
                            onReview={
                              health === "needs_review" && onReviewTimeConflict
                                ? () => onReviewTimeConflict(ev)
                                : undefined
                            }
                          />
                          <span className="min-w-0 flex-1">
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
                            {ev.observacoes?.trim() ? (
                              <span className="block text-xs text-slate-500 mt-0.5 italic truncate">
                                {ev.observacoes.trim()}
                              </span>
                            ) : null}
                          </span>
                        </span>
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
