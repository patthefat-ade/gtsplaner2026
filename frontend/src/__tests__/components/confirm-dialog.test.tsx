import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Löschen bestätigen",
    description: "Möchten Sie diesen Eintrag wirklich löschen?",
    onConfirm: vi.fn(),
  };

  it("should render title and description when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Löschen bestätigen")).toBeInTheDocument();
    expect(
      screen.getByText("Möchten Sie diesen Eintrag wirklich löschen?")
    ).toBeInTheDocument();
  });

  it("should render default button labels", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Bestätigen")).toBeInTheDocument();
    expect(screen.getByText("Abbrechen")).toBeInTheDocument();
  });

  it("should render custom button labels", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Ja, löschen"
        cancelLabel="Nein"
      />
    );
    expect(screen.getByText("Ja, löschen")).toBeInTheDocument();
    expect(screen.getByText("Nein")).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Bestätigen"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("should call onOpenChange(false) when cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText("Abbrechen"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should show loading text when isLoading", () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />);
    expect(screen.getByText("Wird ausgeführt...")).toBeInTheDocument();
  });

  it("should disable buttons when isLoading", () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />);

    expect(screen.getByText("Abbrechen")).toBeDisabled();
    expect(screen.getByText("Wird ausgeführt...")).toBeDisabled();
  });

  it("should not render when closed", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Löschen bestätigen")).not.toBeInTheDocument();
  });
});
