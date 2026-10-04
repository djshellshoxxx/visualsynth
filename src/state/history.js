import { reducePatch } from './patch-state.js';

export class HistoryController {
  constructor(initialState) {
    this.state = structuredClone(initialState);
    this.past = [];
    this.future = [];
    this.lastHistoryGroup = null;
  }

  apply(action) {
    const group = action.meta?.historyGroup ?? null;
    const previousState = this.state;
    const nextState = reducePatch(previousState, action);

    if (group && group === this.lastHistoryGroup && this.past.length > 0) {
      this.state = nextState;
      this.future = [];
      return this.state;
    }

    this.past.push(structuredClone(previousState));
    this.state = nextState;
    this.future = [];
    this.lastHistoryGroup = group;
    return this.state;
  }

  undo() {
    if (this.past.length === 0) return false;
    this.future.push(structuredClone(this.state));
    this.state = this.past.pop();
    this.lastHistoryGroup = null;
    return true;
  }

  redo() {
    if (this.future.length === 0) return false;
    this.past.push(structuredClone(this.state));
    this.state = this.future.pop();
    this.lastHistoryGroup = null;
    return true;
  }
}
