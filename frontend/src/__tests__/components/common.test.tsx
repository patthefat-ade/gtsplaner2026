import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import {
  LoadingSpinner,
  PageLoading,
  InlineLoading,
} from "@/components/common/loading-spinner";

// ─── PageHeader ─────────────────────────────────────────────────────────────

describe("PageHeader", () => {
  it("should render title", () => {
    render(<PageHeader title="Transaktionen" />);
    expect(screen.getByText("Transaktionen")).toBeInTheDocument();
  });

  it("should render description when provided", () => {
    render(
      <PageHeader
        title="Transaktionen"
        description="Alle Einnahmen und Ausgaben"
      />
    );
    expect(screen.getByText("Alle Einnahmen und Ausgaben")).toBeInTheDocument();
  });

  it("should not render description when not provided", () => {
    const { container } = render(<PageHeader title="Test" />);
    const description = container.querySelector(".text-muted-foreground");
    expect(description).toBeNull();
  });

  it("should render children (action buttons)", () => {
    render(
      <PageHeader title="Test">
        <button>Neu erstellen</button>
      </PageHeader>
    );
    expect(screen.getByText("Neu erstellen")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <PageHeader title="Test" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

// ─── EmptyState ─────────────────────────────────────────────────────────────

describe("EmptyState", () => {
  it("should render title", () => {
    render(<EmptyState title="Keine Daten vorhanden" />);
    expect(screen.getByText("Keine Daten vorhanden")).toBeInTheDocument();
  });

  it("should render description when provided", () => {
    render(
      <EmptyState
        title="Keine Daten"
        description="Es wurden noch keine Einträge erstellt."
      />
    );
    expect(
      screen.getByText("Es wurden noch keine Einträge erstellt.")
    ).toBeInTheDocument();
  });

  it("should render action button when provided", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="Keine Daten"
        actionLabel="Erstellen"
        onAction={onAction}
      />
    );
    const button = screen.getByText("Erstellen");
    expect(button).toBeInTheDocument();
  });

  it("should call onAction when button is clicked", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="Keine Daten"
        actionLabel="Erstellen"
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByText("Erstellen"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("should not render button when no actionLabel", () => {
    render(<EmptyState title="Keine Daten" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// ─── LoadingSpinner ─────────────────────────────────────────────────────────

describe("LoadingSpinner", () => {
  it("should render without text", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should render with text", () => {
    render(<LoadingSpinner text="Laden..." />);
    expect(screen.getByText("Laden...")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(<LoadingSpinner className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });
});

describe("PageLoading", () => {
  it("should render loading text", () => {
    render(<PageLoading />);
    expect(screen.getByText("Laden...")).toBeInTheDocument();
  });
});

describe("InlineLoading", () => {
  it("should render inline spinner", () => {
    const { container } = render(<InlineLoading />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
