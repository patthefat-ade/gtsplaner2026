"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  receiptUploadSchema,
  type ReceiptUploadFormData,
} from "@/lib/validations";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface ReceiptUploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: number;
  onSubmit: (transactionId: number, data: FormData) => Promise<void>;
  isLoading?: boolean;
}

export function ReceiptUploadForm({
  open,
  onOpenChange,
  transactionId,
  onSubmit,
  isLoading = false,
}: ReceiptUploadFormProps) {
  const form = useForm<ReceiptUploadFormData>({
    resolver: zodResolver(receiptUploadSchema),
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ file: undefined, description: "" });
    }
  }, [open, form]);

  const handleSubmit = async (data: ReceiptUploadFormData) => {
    const formData = new FormData();
    formData.append("file", data.file);
    if (data.description) {
      formData.append("description", data.description);
    }
    try {
      await onSubmit(transactionId, formData);
      onOpenChange(false);
    } catch {
      // Error handling done by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Beleg hochladen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Datei</FormLabel>
                  <FormControl>
                    <FileUpload
                      value={field.value}
                      onChange={(file) => field.onChange(file)}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      maxSize={10}
                      placeholder="Beleg hochladen (JPEG, PNG, WebP, PDF)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Kassenbon Müller" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Hochladen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
