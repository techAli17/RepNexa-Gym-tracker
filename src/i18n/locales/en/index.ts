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

export const en = { common, errors, nav, home, plan, routines, workout, exercises, history, progress, settings, backup };
export type Dictionary = typeof en;
