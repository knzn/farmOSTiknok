// Core exports — the public API of the marking engine
export { generateMarkings } from './algorithm.js'
export {
  validateMarking,
  isValidCombo,
  getNoseGroup,
} from './validate.js'
export {
  getConflicts,
  getAllValidCombos,
  getCombosByGroup,
  buildComboString,
  conflictsWith,
  NOSE_MARKS,
  FEET_MARKS,
  NOSE_PRIORITY,
  SHORTHAND_EXPANSIONS,
  CONFLICTS,
} from './combos.js'
export type {
  MatingInput,
  MandatoryOverride,
  MarkingAssignment,
  HenAssignment,
  NoseGroup,
  ValidationResult,
} from './types.js'
