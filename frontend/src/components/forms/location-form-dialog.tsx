"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { Location, LocationCreate } from "@/types/models";

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onSubmit: (data: LocationCreate) => Promise<void>;
  isLoading: boolean;
}

export function LocationFormDialog({
  open,
  onOpenChange,
  location,
  onSubmit,
  isLoading,
}: LocationFormDialogProps) {
  const isEdit = !!location;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  React.useEffect(() => {
    if (open) {
      setName(location?.name || "");
      setDescription(location?.description || "");
      setEmail(location?.email || "");
      setPhone(location?.phone || "");
      setStreet(location?.street || "");
      setCity(location?.city || "");
      setPostalCode(location?.postal_code || "");
    }
  }, [open, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name,
      description,
      email,
      phone,
      street,
      city,
      postal_code: postalCode,
      organization: location?.organization || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Standort bearbeiten" : "Neuer Standort"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="loc-name">Name *</Label>
            <Input
              id="loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. VS Annabichl"
              required
            />
          </div>

          <div>
            <Label htmlFor="loc-desc">Beschreibung</Label>
            <Textarea
              id="loc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung des Standorts"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="loc-email">E-Mail</Label>
              <Input
                id="loc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="standort@hilfswerk.at"
              />
            </div>
            <div>
              <Label htmlFor="loc-phone">Telefon</Label>
              <Input
                id="loc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+43 ..."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="loc-street">Straße</Label>
              <Input
                id="loc-street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Straße und Hausnummer"
              />
            </div>
            <div>
              <Label htmlFor="loc-postal">PLZ</Label>
              <Input
                id="loc-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="9020"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="loc-city">Stadt</Label>
            <Input
              id="loc-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Klagenfurt"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading || !name}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
