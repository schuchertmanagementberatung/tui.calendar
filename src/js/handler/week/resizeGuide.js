/**
 * @fileoverview Module for modification of guide element in schedule resize
 * @author NHN FE Development Lab <dl_javascript@nhn.com>
 */
'use strict';

var util = require('tui-code-snippet');

var config = require('../../config'),
    domutil = require('../../common/domutil'),
    MonthGuide = require('./guide');

/**
 * @constructor
 * @param {WeekResize} WeekResize - month/resize module instance
 */
function WeekResizeGuide(WeekResize) {
    /**
     * @type {WeekResize}
     */
    this.WeekResize = WeekResize;

    /**
     * @type {HTMLElement[]}
     */
    this.elements = null;

    /**
     * @type {MonthGuide}
     */
    this.guide = null;

    WeekResize.on({
        WeekResizeDragstart: this._onDragStart,
        WeekResizeDrag: this._onDrag,
        WeekResizeDragend: this._onDragEnd
    }, this);
}

/**
 * Destructor
 */
WeekResizeGuide.prototype.destroy = function() {
    this.WeekResize.off(this);
    this.guide.destroy();

    this.guide = this.WeekResize = null;
};

/**
 * Hide element blocks for resize effect
 * @param {number} modelID - Schedule model instance ID
 */
WeekResizeGuide.prototype._hideScheduleBlocks = function(modelID) {
    this.elements = domutil.find(
        config.classname('.weekday-schedule-block-' + modelID),
        this.WeekResize.monthView.container,
        true
    );

    util.forEach(this.elements, function(el) {
        el.style.display = 'none';
    });
};

/**
 * Show element blocks
 */
WeekResizeGuide.prototype._showScheduleBlocks = function() {
    util.forEach(this.elements, function(el) {
        el.style.display = 'block';
    });
};

/**
 * Drag start event handler
 * @param {object} dragStartEvent - schedule data from WeekResize
 */
WeekResizeGuide.prototype._onDragStart = function(dragStartEvent) {
    this.guide = new MonthGuide({
        isResizeMode: true
    }, this.WeekResize.monthView);

    this.guide.start(dragStartEvent);

    this._hideScheduleBlocks(dragStartEvent.model.cid());

    if (!util.browser.msie) {
        domutil.addClass(global.document.body, config.classname('resizing-x'));
    }
};

/**
 * Drag event handler
 * @param {object} dragEvent - event data from MonthCreation
 */
WeekResizeGuide.prototype._onDrag = function(dragEvent) {
    this.guide.update(dragEvent.x, dragEvent.y);
};

/**
 * Drag end event handler
 */
WeekResizeGuide.prototype._onDragEnd = function() {
    this._showScheduleBlocks();

    this.guide.destroy();
    this.elements = this.guide = null;

    if (!util.browser.msie) {
        domutil.removeClass(global.document.body, config.classname('resizing-x'));
    }
};

module.exports = WeekResizeGuide;
