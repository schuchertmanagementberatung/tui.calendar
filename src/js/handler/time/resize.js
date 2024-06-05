/**
 * @fileoverview Handling resize schedules from drag handler and time grid view
 * @author NHN FE Development Lab <dl_javascript@nhn.com>
 */
'use strict';

var util = require('tui-code-snippet');
var config = require('../../config');
var datetime = require('../../common/datetime');
var domutil = require('../../common/domutil');
var TZDate = require('../../common/timezone').Date;
var common = require('../../common/common');
var timeCore = require('./core');
var TimeResizeGuide = require('./resizeGuide');

/**
 * @constructor
 * @implements {Handler}
 * @mixes timeCore
 * @mixes util.CustomEvents
 * @param {Drag} [dragHandler] - Drag handler instance.
 * @param {TimeGrid} [timeGridView] - TimeGrid view instance.
 * @param {Base} [baseController] - Base controller instance.
 */
function TimeResize(dragHandler, timeGridView, baseController) {
    /**
     * @type {Drag}
     */
    this.dragHandler = dragHandler;

    /**
     * @type {TimeGrid}
     */
    this.timeGridView = timeGridView;

    /**
     * @type {Base}
     */
    this.baseController = baseController;

    /**
     * @type {function}
     */
    this._getScheduleDataFunc = null;

    /**
     * @type {object}
     */
    this._dragStart = null;

    /**
     * @type {TimeResizeGuide}
     */
    this._guide = new TimeResizeGuide(this);

    dragHandler.on('dragStart', this._onDragStart, this);
}

/**
 * Destroy method
 */
TimeResize.prototype.destroy = function() {
    this._guide.destroy();
    this.dragHandler.off(this);
    this.dragHandler = this.timeGridView = this.baseController =
        this._getScheduleDataFunc = this._dragStart = this._guide = null;
};

/**
 * @param {HTMLElement} target - element to check condition.
 * @returns {object|boolean} - return time view instance or false
 */
TimeResize.prototype.checkExpectCondition = function(target) {
    var container,
        matches;

    if (!domutil.hasClass(target, config.classname('time-resize-handle'))) {
        return false;
    }

    container = domutil.closest(target, config.classname('.time-date'));

    if (!container) {
        return false;
    }

    matches = domutil.getClass(container).match(config.time.getViewIDRegExp);

    if (!matches || matches.length < 2) {
        return false;
    }

    return util.pick(this.timeGridView.children.items, Number(matches[1]));
};

/**
 * @emits TimeResize#timeResizeDragstart
 * @param {object} dragStartEventData - event data of Drag#dragstart
 */
TimeResize.prototype._onDragStart = function(dragStartEventData) {
    var target = dragStartEventData.target,
        timeView = this.checkExpectCondition(target),
        blockElement = domutil.closest(target, config.classname('.time-date-schedule-block')),
        ctrl = this.baseController,
        blockElementBoundingClientRect,
        blockElementTopY,
        blockElementBottomY,
        blockElementDraggingTopThreshold,
        mouseStartY,
        isDraggingTop,
        targetModelID,
        getScheduleDataFunc,
        scheduleData;

    if (blockElement) {
        blockElementBoundingClientRect = blockElement.getBoundingClientRect();
        blockElementTopY = blockElementBoundingClientRect.top;
        blockElementBottomY = blockElementBoundingClientRect.top + blockElementBoundingClientRect.height;
        blockElementDraggingTopThreshold = blockElementTopY + ((blockElementBottomY - blockElementTopY) / 2);
        mouseStartY = dragStartEventData.originEvent.clientY;
        isDraggingTop = mouseStartY <= blockElementDraggingTopThreshold;
    }

    // console.log('top', blockElementTopY, 'bottom', blockElementBottomY, 'mouseY', mouseStartY);
    // console.log('isdraggingtop', isDraggingTop);
    if (!timeView || !blockElement) {
        return;
    }

    targetModelID = domutil.getData(blockElement, 'id');
    getScheduleDataFunc = this._getScheduleDataFunc = this._retriveScheduleData(timeView);
    scheduleData = this._dragStart = getScheduleDataFunc(
        dragStartEventData.originEvent, {
            targetModelID: targetModelID,
            schedule: ctrl.schedules.items[targetModelID]
        }
    );

    if (isDraggingTop) {
        this.dragHandler.on({
            drag: this._onDragTop,
            dragEnd: this._onDragEndTop,
            click: this._onClick
        }, this);
    } else {
        this.dragHandler.on({
            drag: this._onDrag,
            dragEnd: this._onDragEnd,
            click: this._onClick
        }, this);
    }

    /**
     * @event TimeResize#timeResizeDragstart
     * @type {object}
     * @property {HTMLElement} target - current target in mouse event object.
     * @property {Time} relatedView - time view instance related with mouse position.
     * @property {MouseEvent} originEvent - mouse event object.
     * @property {number} mouseY - mouse Y px mouse event.
     * @property {number} gridY - grid Y index value related with mouseY value.
     * @property {number} timeY - milliseconds value of mouseY points.
     * @property {number} nearestGridY - nearest grid index related with mouseY value.
     * @property {number} nearestGridTimeY - time value for nearestGridY.
     * @property {string} targetModelID - The model unique id emitted move schedule.
     * @property {Schedule} schedule - schedule data
     */
    this.fire('timeResizeDragstart', scheduleData);
};

/**
 * Drag#drag event handler
 * @emits TimeResize#timeResizeDrag
 * @param {object} dragEventData - event data of Drag#drag custom event.
 * @param {string} [overrideEventName] - override emitted event name when supplied.
 * @param {function} [revise] - supply function for revise schedule data before emit.
 */
TimeResize.prototype._onDrag = function(dragEventData, overrideEventName, revise) {
    var getScheduleDataFunc = this._getScheduleDataFunc,
        startScheduleData = this._dragStart,
        scheduleData;

    if (!getScheduleDataFunc || !startScheduleData) {
        return;
    }

    scheduleData = getScheduleDataFunc(dragEventData.originEvent, {
        targetModelID: startScheduleData.targetModelID
    });

    if (revise) {
        revise(scheduleData);
    }

    /**
     * @event TimeResize#timeResizeDrag
     * @type {object}
     * @property {HTMLElement} target - current target in mouse event object.
     * @property {Time} relatedView - time view instance related with drag start position.
     * @property {MouseEvent} originEvent - mouse event object.
     * @property {number} mouseY - mouse Y px mouse event.
     * @property {number} gridY - grid Y index value related with mouseY value.
     * @property {number} timeY - milliseconds value of mouseY points.
     * @property {number} nearestGridY - nearest grid index related with mouseY value.
     * @property {number} nearestGridTimeY - time value for nearestGridY.
     * @property {string} targetModelID - The model unique id emitted move schedule.
     */
    this.fire(overrideEventName || 'timeResizeDrag', scheduleData);
};

/**
 * Drag#drag event handler
 * @emits TimeResize#timeResizeDrag
 * @param {object} dragEventData - event data of Drag#drag custom event.
 * @param {string} [overrideEventName] - override emitted event name when supplied.
 * @param {function} [revise] - supply function for revise schedule data before emit.
 */
TimeResize.prototype._onDragTop = function(dragEventData, overrideEventName, revise) {
    var getScheduleDataFunc = this._getScheduleDataFunc,
        startScheduleData = this._dragStart,
        scheduleData;

    if (!getScheduleDataFunc || !startScheduleData) {
        return;
    }

    scheduleData = getScheduleDataFunc(dragEventData.originEvent, {
        targetModelID: startScheduleData.targetModelID
    });

    if (revise) {
        revise(scheduleData);
    }

    /**
     * @event TimeResize#timeResizeDrag
     * @type {object}
     * @property {HTMLElement} target - current target in mouse event object.
     * @property {Time} relatedView - time view instance related with drag start position.
     * @property {MouseEvent} originEvent - mouse event object.
     * @property {number} mouseY - mouse Y px mouse event.
     * @property {number} gridY - grid Y index value related with mouseY value.
     * @property {number} timeY - milliseconds value of mouseY points.
     * @property {number} nearestGridY - nearest grid index related with mouseY value.
     * @property {number} nearestGridTimeY - time value for nearestGridY.
     * @property {string} targetModelID - The model unique id emitted move schedule.
     */
    this.fire(overrideEventName || 'timeResizeDragTop', scheduleData);
};

/**
 * Update model instance by dragend event results.
 * @fires TimeResize#beforeUpdateSchedule
 * @param {object} scheduleData - schedule data from TimeResize#timeResizeDragend
 */
TimeResize.prototype._updateSchedule = function(scheduleData) {
    var ctrl = this.baseController,
        modelID = scheduleData.targetModelID,
        range = scheduleData.nearestRange,
        timeDiff = range[1] - range[0],
        schedule = ctrl.schedules.items[modelID],
        relatedView = scheduleData.relatedView,
        dateEnd,
        newEnds,
        baseDate;
    var changes;

    if (!schedule) {
        return;
    }

    timeDiff -= datetime.millisecondsFrom('minutes', 30);

    baseDate = new TZDate(relatedView.getDate());
    // dateStart = datetime.start(baseDate);
    dateEnd = datetime.end(baseDate);
    // newStarts = new TZDate(schedule.getEnds()).addMilliseconds(timeDiff);
    newEnds = new TZDate(schedule.getEnds()).addMilliseconds(timeDiff);

    if (newEnds > dateEnd) {
        newEnds = new TZDate(dateEnd);
    }

    if (newEnds.getTime() - schedule.getStarts().getTime() < datetime.millisecondsFrom('minutes', 30)) {
        newEnds = new TZDate(schedule.getStarts()).addMinutes(30);
    }

    if (newEnds.getTime() > new TZDate(baseDate).addDate(1)) {
        newEnds = new TZDate(baseDate).addDate(1).addMinutes(-1);
    }

    changes = common.getScheduleChanges(
        schedule,
        ['end'],
        {end: newEnds}
    );

    /**
     * @event TimeResize#beforeUpdateSchedule
     * @type {object}
     * @property {Schedule} schedule - The original schedule instance
     * @property {Date} start - Deprecated: start time to update
     * @property {Date} end - Deprecated: end time to update
     * @property {object} changes - end time to update
     *  @property {date} end - end time to update
     */
    this.fire('beforeUpdateSchedule', {
        schedule: schedule,
        changes: changes,
        start: schedule.getStarts(),
        end: newEnds
    });
};

/**
 * Update model instance by dragend event results.
 * @fires TimeResize#beforeUpdateSchedule
 * @param {object} scheduleData - schedule data from TimeResize#timeResizeDragend
 */
TimeResize.prototype._updateScheduleTop = function(scheduleData) {
    var ctrl = this.baseController,
        modelID = scheduleData.targetModelID,
        range = scheduleData.nearestRange,
        timeDiff = range[1] - range[0],
        schedule = ctrl.schedules.items[modelID],
        relatedView = scheduleData.relatedView,
        // dateEnd,
        newStarts,
        baseDate;
    var changes;

    if (!schedule) {
        return;
    }

    timeDiff -= datetime.millisecondsFrom('minutes', 30);

    baseDate = new TZDate(relatedView.getDate());
    // dateStart = datetime.start(baseDate);
    // dateEnd = datetime.end(baseDate);
    // newStarts = new TZDate(schedule.getEnds()).addMilliseconds(timeDiff);
    newStarts = new TZDate(schedule.getStarts()).addMilliseconds(timeDiff);

    if (newStarts < baseDate) {
        newStarts = new TZDate(baseDate);
    }

    if (schedule.getEnds().getTime() - newStarts.getTime() < datetime.millisecondsFrom('minutes', 30)) {
        newStarts = new TZDate(schedule.getEnds()).addMinutes(-30);
    }

    if (newStarts.getTime() < baseDate.getTime()) {
        newStarts = new TZDate(baseDate);
    }

    changes = common.getScheduleChanges(
        schedule,
        ['start'],
        {start: newStarts}
    );

    /**
     * @event TimeResize#beforeUpdateSchedule
     * @type {object}
     * @property {Schedule} schedule - The original schedule instance
     * @property {Date} start - Deprecated: start time to update
     * @property {Date} end - Deprecated: end time to update
     * @property {object} changes - end time to update
     *  @property {date} end - end time to update
     */
    this.fire('beforeUpdateSchedule', {
        schedule: schedule,
        changes: changes,
        start: newStarts,
        end: schedule.getEnds()
    });
};

/**
 * Drag#dragEnd event handler
 * @emits TimeResize#timeResizeDragend
 * @param {MouseEvent} dragEndEventData - Mouse event of Drag#dragEnd custom event.
 */
TimeResize.prototype._onDragEnd = function(dragEndEventData) {
    var getScheduleDataFunc = this._getScheduleDataFunc,
        dragStart = this._dragStart,
        scheduleData;

    this.dragHandler.off({
        drag: this._onDrag,
        dragEnd: this._onDragEnd,
        click: this._onClick
    }, this);

    if (!getScheduleDataFunc || !dragStart) {
        return;
    }

    scheduleData = getScheduleDataFunc(dragEndEventData.originEvent, {
        targetModelID: dragStart.targetModelID
    });

    scheduleData.range = [
        dragStart.timeY,
        new TZDate(scheduleData.timeY).addMinutes(30)
    ];

    scheduleData.nearestRange = [
        dragStart.nearestGridTimeY,
        scheduleData.nearestGridTimeY.addMinutes(30)
    ];

    // console.log('update schedule with data (dragend):', scheduleData);

    this._updateSchedule(scheduleData);

    /**
     * @event TimeResize#timeResizeDragend
     * @type {object}
     * @property {HTMLElement} target - current target in mouse event object.
     * @property {Time} relatedView - time view instance related with drag start position.
     * @property {MouseEvent} originEvent - mouse event object.
     * @property {number} mouseY - mouse Y px mouse event.
     * @property {number} gridY - grid Y index value related with mouseY value.
     * @property {number} timeY - milliseconds value of mouseY points.
     * @property {number} nearestGridY - nearest grid index related with mouseY value.
     * @property {number} nearestGridTimeY - time value for nearestGridY.
     * @property {string} targetModelID - The model unique id emitted move schedule.
     * @property {number[]} range - milliseconds range between drag start and end.
     * @property {number[]} nearestRange - milliseconds range related with nearestGridY between start and end.
     */
    this.fire('timeResizeDragend', scheduleData);

    this._getScheduleDataFunc = this._dragStart = null;
};

/**
 * Drag#dragEnd event handler
 * @emits TimeResize#timeResizeDragend
 * @param {MouseEvent} dragEndEventData - Mouse event of Drag#dragEnd custom event.
 */
TimeResize.prototype._onDragEndTop = function(dragEndEventData) {
    var getScheduleDataFunc = this._getScheduleDataFunc,
        dragStart = this._dragStart,
        scheduleData;

    this.dragHandler.off({
        drag: this._onDragTop,
        dragEnd: this._onDragEndTop,
        click: this._onClick
    }, this);

    if (!getScheduleDataFunc || !dragStart) {
        return;
    }

    scheduleData = getScheduleDataFunc(dragEndEventData.originEvent, {
        targetModelID: dragStart.targetModelID
    });

    scheduleData.range = [
        dragStart.timeY,
        new TZDate(scheduleData.timeY).addMinutes(30)
    ];

    scheduleData.nearestRange = [
        dragStart.nearestGridTimeY,
        scheduleData.nearestGridTimeY.addMinutes(30)
    ];

    // console.log('drag end top - scheduledata', scheduleData);

    this._updateScheduleTop(scheduleData);

    /**
     * @event TimeResize#timeResizeDragend
     * @type {object}
     * @property {HTMLElement} target - current target in mouse event object.
     * @property {Time} relatedView - time view instance related with drag start position.
     * @property {MouseEvent} originEvent - mouse event object.
     * @property {number} mouseY - mouse Y px mouse event.
     * @property {number} gridY - grid Y index value related with mouseY value.
     * @property {number} timeY - milliseconds value of mouseY points.
     * @property {number} nearestGridY - nearest grid index related with mouseY value.
     * @property {number} nearestGridTimeY - time value for nearestGridY.
     * @property {string} targetModelID - The model unique id emitted move schedule.
     * @property {number[]} range - milliseconds range between drag start and end.
     * @property {number[]} nearestRange - milliseconds range related with nearestGridY between start and end.
     */
    this.fire('timeResizeDragend', scheduleData);

    this._getScheduleDataFunc = this._dragStart = null;
};

/**
 * @emits TimeResize#timeResizeClick
 */
TimeResize.prototype._onClick = function() {
    this.dragHandler.off({
        drag: this._onDrag,
        dragEnd: this._onDragEnd,
        click: this._onClick
    }, this);
    this.dragHandler.off({
        drag: this._onDragTop,
        dragEnd: this._onDragEndTop,
        click: this._onClick
    }, this);

    /**
     * @event TimeResize#timeResizeClick
     */
    this.fire('timeResizeClick');
};

timeCore.mixin(TimeResize);
util.CustomEvents.mixin(TimeResize);

module.exports = TimeResize;
