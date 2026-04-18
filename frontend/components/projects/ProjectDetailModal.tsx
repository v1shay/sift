import { Dialog } from "@/components/ui/dialog";

type ProjectDetailModalProps = {
  title: string;
  onClose?: () => void;
};

export function ProjectDetailModal({ title }: ProjectDetailModalProps) {
  return (
    <Dialog>
      <div className="w-full max-w-xl rounded-lg bg-white p-6">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
      </div>
    </Dialog>
  );
}

