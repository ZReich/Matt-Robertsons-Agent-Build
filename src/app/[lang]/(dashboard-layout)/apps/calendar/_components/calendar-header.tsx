import { useState } from "react";
import { CalendarApi } from "@fullcalendar/core/index.js";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";

import { initialView } from "@/constants";

import { CalendarState, Category } from "@/types";

import { Button } from "@/components/ui/button";
import { EventFilters } from "./event-filters";

interface CalendarHeaderProps {
  calendarState: CalendarState;
  calendarApi: CalendarApi | null;
  setEventSidebarIsOpen: (value: boolean) => void;
  handleSelectCategory: (category: Category) => void;
  handleSelectAllCategories: (isSelectAll: boolean) => void;
}

export function CalendarHeader({
  calendarState,
  calendarApi,
  setEventSidebarIsOpen,
  handleSelectCategory,
  handleSelectAllCategories,
}: CalendarHeaderProps) {
  const [currentView, setCurrentView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const handleDateChange = (newDate: Date) => {
    if (calendarApi) {
      calendarApi.gotoDate(newDate);
      setCurrentDate(newDate);
    }
  };

  const handlePrev = () => {
    if (calendarApi) {
      calendarApi.prev();
      handleDateChange(calendarApi.getDate());
    }
  };

  const handleNext = () => {
    if (calendarApi) {
      calendarApi.next();
      handleDateChange(calendarApi.getDate());
    }
  };

  const handleViewChange = (view: string) => {
    if (calendarApi) {
      calendarApi.changeView(view);
      handleDateChange(calendarApi.getDate());
      setCurrentView(view);
    }
  };

  const formatTitle = (date: Date, view: string) => {
    if (view === "dayGridMonth") {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
    } else if (view === "timeGridWeek" || view === "listWeek") {
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 6);
      return `${date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

  return (
    <div className="mb-4 flex flex-col justify-between items-center gap-4 md:flex-row">
      <div className="flex items-center space-x-4">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEventSidebarIsOpen(true)}
          >
            <CalendarPlus className="h-4 w-4" />
            <span className="sr-only">Add New Event</span>
          </Button>
          <EventFilters
            handleSelectCategory={handleSelectCategory}
            handleSelectAllCategories={handleSelectAllCategories}
            calendarState={calendarState}
          />
          <Button variant="outline" size="sm" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous Month</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next Month</span>
          </Button>
        </div>
        <h2 className="text-lg font-semibold">
          {formatTitle(currentDate, currentView)}
        </h2>
      </div>
      <div className="space-x-2">
        <Button
          variant={currentView === "dayGridMonth" ? "default" : "outline"}
          size="sm"
          onClick={() => handleViewChange("dayGridMonth")}
        >
          Month
        </Button>
        <Button
          variant={currentView === "timeGridWeek" ? "default" : "outline"}
          size="sm"
          onClick={() => handleViewChange("timeGridWeek")}
        >
          Week
        </Button>
        <Button
          variant={currentView === "timeGridDay" ? "default" : "outline"}
          size="sm"
          onClick={() => handleViewChange("timeGridDay")}
        >
          Day
        </Button>
        <Button
          variant={currentView === "listWeek" ? "default" : "outline"}
          size="sm"
          onClick={() => handleViewChange("listWeek")}
        >
          List
        </Button>
      </div>
    </div>
  );
}
