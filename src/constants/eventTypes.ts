// Single source of truth for all event type metadata.
//
// To add a new event type:
//   1. Add the string literal to the EventType union in src/types/index.ts
//   2. Add a hex color (with an inline comment) to EVENT_TYPE_COLOR below
//   3. Add a display label to EVENT_TYPE_LABEL below
//   4. Add a { value, label } entry to EVENT_TYPES below (for dropdowns)

import type { EventType } from '../types';

export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  FASHION_SHOW:     '#EC4899', // pink — fashion / runway
  LISTENING_PARTY:  '#8B5CF6', // violet — music / audio
  NETWORKING:       '#3B82F6', // blue — professional
  WORKSHOP:         '#F59E0B', // amber — learning
  MASTERCLASS:      '#F59E0B', // amber — learning (matches Workshop)
  COMMUNITY:        '#22C55E', // green — community
  PERFORMANCE:      '#EC4899', // pink — live arts
  OPEN_MIC:         '#A855F7', // purple — spoken / music
  SCREENING:        '#06B6D4', // cyan — film / visual
  STUDIO_SESSION:   '#10B981', // emerald — production
  PANEL:            '#3B82F6', // blue — discussion
  CRITIQUE_SESSION: '#F97316', // orange — feedback
  HACKATHON:        '#EF4444', // red — intense / competitive
  COLLAB_SESSION:   '#22C55E', // green — collaborative
  OPEN_CALL:        '#F59E0B', // amber — opportunity
  POP_UP:           '#EC4899', // pink — retail / fashion
  MARKET:           '#10B981', // emerald — commerce
  LAUNCH_PARTY:     '#8B5CF6', // violet — celebration
  EXHIBITION:       '#06B6D4', // cyan — gallery / art
  OPEN_STUDIO:      '#10B981', // emerald — creative space
  PHOTOSHOOT:       '#F43F5E', // rose — visual / photo
  GROUP_RUN:        '#22C55E', // green — fitness
  FITNESS_CLASS:    '#EF4444', // red — active / energy
  RETREAT:          '#6366F1', // indigo — calm / reflective
  GAME_NIGHT:       '#F59E0B', // amber — fun
  BLOCK_PARTY:      '#F97316', // orange — outdoor / community
  COMPETITION:      '#EF4444', // red — competitive
  CHARITY:          '#22C55E', // green — giving
  VIRTUAL_EVENT:    '#6366F1', // indigo — digital
  OTHER:            '#6B7280', // gray — catchall
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  FASHION_SHOW:     'Fashion Show',
  PERFORMANCE:      'Performance',
  OPEN_MIC:         'Open Mic',
  SCREENING:        'Screening',
  LISTENING_PARTY:  'Listening Party',
  STUDIO_SESSION:   'Studio Session',
  WORKSHOP:         'Workshop',
  MASTERCLASS:      'Masterclass',
  PANEL:            'Panel',
  CRITIQUE_SESSION: 'Critique',
  HACKATHON:        'Hackathon',
  NETWORKING:       'Networking',
  COMMUNITY:        'Community',
  COLLAB_SESSION:   'Collab Session',
  OPEN_CALL:        'Open Call',
  POP_UP:           'Pop-Up',
  MARKET:           'Market',
  LAUNCH_PARTY:     'Launch Party',
  EXHIBITION:       'Exhibition',
  OPEN_STUDIO:      'Open Studio',
  PHOTOSHOOT:       'Photoshoot',
  GROUP_RUN:        'Group Run',
  FITNESS_CLASS:    'Fitness Class',
  RETREAT:          'Retreat',
  GAME_NIGHT:       'Game Night',
  BLOCK_PARTY:      'Block Party',
  COMPETITION:      'Competition',
  CHARITY:          'Charity',
  VIRTUAL_EVENT:    'Virtual Event',
  OTHER:            'Other',
};

/** Ordered list used by event-creation dropdowns. */
export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'FASHION_SHOW',     label: EVENT_TYPE_LABEL.FASHION_SHOW },
  { value: 'PERFORMANCE',      label: EVENT_TYPE_LABEL.PERFORMANCE },
  { value: 'OPEN_MIC',         label: EVENT_TYPE_LABEL.OPEN_MIC },
  { value: 'SCREENING',        label: EVENT_TYPE_LABEL.SCREENING },
  { value: 'LISTENING_PARTY',  label: EVENT_TYPE_LABEL.LISTENING_PARTY },
  { value: 'STUDIO_SESSION',   label: EVENT_TYPE_LABEL.STUDIO_SESSION },
  { value: 'WORKSHOP',         label: EVENT_TYPE_LABEL.WORKSHOP },
  { value: 'MASTERCLASS',      label: EVENT_TYPE_LABEL.MASTERCLASS },
  { value: 'PANEL',            label: EVENT_TYPE_LABEL.PANEL },
  { value: 'CRITIQUE_SESSION', label: EVENT_TYPE_LABEL.CRITIQUE_SESSION },
  { value: 'HACKATHON',        label: EVENT_TYPE_LABEL.HACKATHON },
  { value: 'NETWORKING',       label: EVENT_TYPE_LABEL.NETWORKING },
  { value: 'COMMUNITY',        label: EVENT_TYPE_LABEL.COMMUNITY },
  { value: 'COLLAB_SESSION',   label: EVENT_TYPE_LABEL.COLLAB_SESSION },
  { value: 'OPEN_CALL',        label: EVENT_TYPE_LABEL.OPEN_CALL },
  { value: 'POP_UP',           label: EVENT_TYPE_LABEL.POP_UP },
  { value: 'MARKET',           label: EVENT_TYPE_LABEL.MARKET },
  { value: 'LAUNCH_PARTY',     label: EVENT_TYPE_LABEL.LAUNCH_PARTY },
  { value: 'EXHIBITION',       label: EVENT_TYPE_LABEL.EXHIBITION },
  { value: 'OPEN_STUDIO',      label: EVENT_TYPE_LABEL.OPEN_STUDIO },
  { value: 'PHOTOSHOOT',       label: EVENT_TYPE_LABEL.PHOTOSHOOT },
  { value: 'GROUP_RUN',        label: EVENT_TYPE_LABEL.GROUP_RUN },
  { value: 'FITNESS_CLASS',    label: EVENT_TYPE_LABEL.FITNESS_CLASS },
  { value: 'RETREAT',          label: EVENT_TYPE_LABEL.RETREAT },
  { value: 'GAME_NIGHT',       label: EVENT_TYPE_LABEL.GAME_NIGHT },
  { value: 'BLOCK_PARTY',      label: EVENT_TYPE_LABEL.BLOCK_PARTY },
  { value: 'COMPETITION',      label: EVENT_TYPE_LABEL.COMPETITION },
  { value: 'CHARITY',          label: EVENT_TYPE_LABEL.CHARITY },
  { value: 'VIRTUAL_EVENT',    label: EVENT_TYPE_LABEL.VIRTUAL_EVENT },
  { value: 'OTHER',            label: EVENT_TYPE_LABEL.OTHER },
];
