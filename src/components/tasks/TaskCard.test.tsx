// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TaskCard, type TaskRecord } from "./TaskCard";

// Mock the formatTime utility
vi.mock("@/lib/utils/format", () => ({
  formatTime: (date: string) => new Date(date).toLocaleString(),
}));

describe("TaskCard", () => {
  const mockTask: TaskRecord = {
    id: "task-123",
    agent_id: "product-hunter",
    status: "completed",
    task_type: "product_research",
    input: { productName: "Test Product", goal: "Find suppliers" },
    output: { suppliers: ["supplier1", "supplier2"] },
    priority: 3,
    error: null,
    depends_on: [],
    parent_task_id: null,
    total_cost: 0.05,
    created_at: "2026-09-03T10:00:00Z",
    started_at: "2026-09-03T10:00:01Z",
    completed_at: "2026-09-03T10:00:05Z",
    agents: { name: "Product Hunter" },
  };

  it("renders task card with correct status", () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("product_research")).toBeInTheDocument();
  });

  it("renders agent name", () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText("Product Hunter")).toBeInTheDocument();
  });

  it("renders input summary", () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText("Test Product")).toBeInTheDocument();
  });

  it("renders cost when greater than 0", () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText("$0.0500")).toBeInTheDocument();
  });

  it("does not render cost when 0", () => {
    const taskWithoutCost = { ...mockTask, total_cost: 0 };
    render(<TaskCard task={taskWithoutCost} />);
    
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument();
  });

  it("renders error message when task failed", () => {
    const failedTask: TaskRecord = {
      ...mockTask,
      status: "failed",
      error: "API rate limit exceeded",
    };
    
    render(<TaskCard task={failedTask} />);
    
    expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders critical priority", () => {
    const criticalTask = { ...mockTask, priority: 1 };
    render(<TaskCard task={criticalTask} />);
    
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });
});
