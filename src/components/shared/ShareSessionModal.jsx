import React from 'react';
import QRCode from 'react-qr-code';
import { Copy, Check, Share2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
  ModalFooter,
  ModalClose
} from '@/components/ui/modal';
import { toast } from 'sonner';

export const ShareSessionModal = ({ open, onOpenChange, session }) => {
  const [copied, setCopied] = React.useState(false);
  
  if (!session) return null;

  const shareUrl = `${window.location.origin}/feedback/anonymous/${session.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = () => {
    window.open(shareUrl, '_blank');
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="max-w-md">
      <ModalClose onClose={() => onOpenChange(false)} />
      <ModalHeader className="p-6 pb-2">
        <ModalTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          Share Feedback Link
        </ModalTitle>
        <ModalDescription>
          Students can scan the QR code or use the link to provide anonymous feedback.
        </ModalDescription>
      </ModalHeader>

      <ModalContent className="p-6 pt-2 space-y-6">
        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-white rounded-2xl border-2 border-primary/10 shadow-sm">
            <QRCode
              value={shareUrl}
              size={200}
              level="H"
              className="w-full h-auto"
            />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{session.topic}</p>
            <p className="text-xs text-muted-foreground">{session.collegeName} • {session.batch}</p>
          </div>
        </div>

        {/* Link Container */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Feedback Link
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 text-sm bg-muted/50 border rounded-lg focus:outline-none"
            />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={handleOpenLink}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </ModalContent>

      <ModalFooter className="p-6 bg-muted/30 border-t">
        <Button onClick={() => onOpenChange(false)} className="w-full">
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};
