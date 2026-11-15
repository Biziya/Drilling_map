import { useCallback, useEffect, useState } from 'react';
import { MAP_ID } from '../config/technoMapConfig';
import { buildHexagons, parseStoredHexagons } from '../utils/hexagons';
import type { HexCell } from '../utils/hexagons';
import { readStored, writeStored } from '../utils/storage';
import { readXlsx } from '../utils/xlsxRead';
import { showToast } from '../../../components/Toast/toastStore';

/** Own key, so the Exploration Map can never pick the upload up. */
export const HEXAGONS_STORAGE_KEY = `${MAP_ID}:hexagons`;

interface HexagonUpload {
  fileName: string;
  cells: HexCell[];
}

/**
 * The production-cell hexagons from the last Excel file uploaded, read in the
 * browser and remembered in it (outlines only, in UTM metres) until another
 * file replaces them or Clear removes them. Nothing is sent to the server.
 */
export function useHexagonUpload(onLoaded?: () => void) {
  const [upload, setUpload] = useState<HexagonUpload | null>(() => parseStoredHexagons(readStored(HEXAGONS_STORAGE_KEY)));
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => writeStored(HEXAGONS_STORAGE_KEY, upload), [upload]);

  const load = useCallback(async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) {
      showToast('error', `${file.name} is not an .xlsx file. Save it as Excel Workbook (.xlsx) and try again.`);
      return;
    }

    setIsUploading(true);
    try {
      const { cells, skipped } = buildHexagons(await readXlsx(await file.arrayBuffer()));
      if (!cells.length) {
        showToast('error', `No hexagons found in ${file.name}: no production cell has three or more wells.`);
        return;
      }
      setUpload({ fileName: file.name, cells });
      onLoaded?.();
      const extra = skipped ? ` (${skipped} with fewer than 3 wells skipped)` : '';
      showToast('success', `Loaded ${cells.length} hexagons from ${file.name}${extra}`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : `${file.name} could not be read.`);
    } finally {
      setIsUploading(false);
    }
  }, [onLoaded]);

  const clear = useCallback(() => setUpload(null), []);

  return { upload, isUploading, load, clear };
}
