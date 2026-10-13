import type { Dictionary } from '../en';
import type { Translation } from '../../types';
import { backup } from './backup';
import { common } from './common';
import { errors } from './errors';
import { exercises } from './exercises';
import { history } from './history';
import { home } from './home';
import { nav } from './nav';
import { plan } from './plan';
import { progress } from './progress';
import { routines } from './routines';
import { settings } from './settings';
import { workout } from './workout';

export const hi: Translation<Dictionary> = { common, errors, nav, home, plan, routines, workout, exercises, history, progress, settings, backup };
