import React from 'react';
import { UniversalExtractionModal } from './UniversalExtractionModal';
import { ExtractedEditorialVocabulary } from '../../services/aiService';
import { ExtractionSourceType } from '../../types/extraction';

export interface YouTubeVocabExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCanvasId?: string | null;
  initialSourceType?: ExtractionSourceType;
  onSuccess?: (canvasId: string, extractedData: ExtractedEditorialVocabulary) => void;
}

/**
 * YouTubeVocabExtractorModal forwards to the Universal 4-Step Extraction Modal.
 */
export function YouTubeVocabExtractorModal(props: YouTubeVocabExtractorModalProps) {
  return <UniversalExtractionModal {...props} initialSourceType={props.initialSourceType || 'youtube'} />;
}

export { UniversalExtractionModal };
