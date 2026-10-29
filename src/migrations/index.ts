import * as migration_20261029_164701_initial from './20261029_164701_initial';

export const migrations = [
  {
    up: migration_20261029_164701_initial.up,
    down: migration_20261029_164701_initial.down,
    name: '20261029_164701_initial'
  },
];
