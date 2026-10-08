import type { DataSource } from '../types';
import { generateDataset } from './generator';

export const mockSource: DataSource = {
  id: 'mock',
  label: 'Dummy data',
  async load() {
    return generateDataset();
  },
};
