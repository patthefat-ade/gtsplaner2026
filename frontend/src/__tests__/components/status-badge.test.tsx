import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, RoleBadge } from "@/components/common/status-badge";

describe("StatusBadge", () => {
  it("should render pending status with correct label", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("Ausstehend")).toBeInTheDocument();
  });

  it("should render approved status with correct label", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText("Genehmigt")).toBeInTheDocument();
  });

  it("should render rejected status with correct label", () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText("Abgelehnt")).toBeInTheDocument();
  });

  it("should render draft status with correct label", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("Entwurf")).toBeInTheDocument();
  });

  it("should render cancelled status with correct label", () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText("Storniert")).toBeInTheDocument();
  });

  it("should render income status with correct label", () => {
    render(<StatusBadge status="income" />);
    expect(screen.getByText("Einnahme")).toBeInTheDocument();
  });

  it("should render expense status with correct label", () => {
    render(<StatusBadge status="expense" />);
    expect(screen.getByText("Ausgabe")).toBeInTheDocument();
  });

  it("should render unknown status as-is", () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText("unknown_status")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <StatusBadge status="active" className="custom-class" />
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("custom-class");
  });
});

describe("RoleBadge", () => {
  it("should render educator role", () => {
    render(<RoleBadge role="educator" />);
    expect(screen.getByText("Pädagog:in")).toBeInTheDocument();
  });

  it("should render location_manager role", () => {
    render(<RoleBadge role="location_manager" />);
    expect(screen.getByText("Standortleitung")).toBeInTheDocument();
  });

  it("should render admin role", () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("should render super_admin role", () => {
    render(<RoleBadge role="super_admin" />);
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("should render unknown role as-is", () => {
    render(<RoleBadge role="custom_role" />);
    expect(screen.getByText("custom_role")).toBeInTheDocument();
  });
});
