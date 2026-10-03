import sodiumLib from 'libsodium-wrappers-sumo';
import type { Sodium } from '../src/index';

// Compile-time check that the Node build satisfies the injected interface.
export const nodeSodium: Sodium = sodiumLib;
