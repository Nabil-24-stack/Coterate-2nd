import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface FigmaFrameDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FigmaFrameDialog({ isOpen, onClose }: FigmaFrameDialogProps) {
  const [figmaUrl, setFigmaUrl] = useState('');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Copy a Figma frame</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <p className="text-center text-gray-600">
            Select a frame and press Command+L on your keyboard
          </p>
          <Input
            placeholder="Paste Figma URL here"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            className="w-full"
          />
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Import Figma frame
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 