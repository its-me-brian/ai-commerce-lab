"use client";

import React from "react";
import { TaskList } from "@/components/tasks/TaskList";

export default function TasksPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Tasks
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          Monitor and manage agent tasks across your workspace
        </p>
      </div>

      {/* Task list */}
      <TaskList limit={100} />
    </div>
  );
}
