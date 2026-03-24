import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "@/components/common/pagination";

describe("Pagination", () => {
  const defaultProps = {
    currentPage: 2,
    totalPages: 5,
    totalItems: 100,
    pageSize: 20,
    onPageChange: vi.fn(),
  };

  it("should render page info text", () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText(/21–40 von 100 Einträgen/)).toBeInTheDocument();
  });

  it("should render current page indicator", () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText("Seite 2 von 5")).toBeInTheDocument();
  });

  it("should call onPageChange with next page", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    const nextButton = screen.getByLabelText("Nächste Seite");
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("should call onPageChange with previous page", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    const prevButton = screen.getByLabelText("Vorherige Seite");
    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("should call onPageChange with first page", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    const firstButton = screen.getByLabelText("Erste Seite");
    fireEvent.click(firstButton);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("should call onPageChange with last page", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    const lastButton = screen.getByLabelText("Letzte Seite");
    fireEvent.click(lastButton);
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it("should disable previous/first buttons on first page", () => {
    render(<Pagination {...defaultProps} currentPage={1} />);

    expect(screen.getByLabelText("Erste Seite")).toBeDisabled();
    expect(screen.getByLabelText("Vorherige Seite")).toBeDisabled();
  });

  it("should disable next/last buttons on last page", () => {
    render(<Pagination {...defaultProps} currentPage={5} />);

    expect(screen.getByLabelText("Nächste Seite")).toBeDisabled();
    expect(screen.getByLabelText("Letzte Seite")).toBeDisabled();
  });

  it("should show correct range for last page with partial items", () => {
    render(
      <Pagination
        {...defaultProps}
        currentPage={5}
        totalItems={95}
        pageSize={20}
      />
    );
    expect(screen.getByText(/81–95 von 95 Einträgen/)).toBeInTheDocument();
  });

  it("should show correct range for first page", () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByText(/1–20 von 100 Einträgen/)).toBeInTheDocument();
  });
});
