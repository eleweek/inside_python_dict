Tangle.classes.TKArrayVis = {
    activeCellClass: 'array-cell-vis-active',
    cellClass: 'array-cell-vis',

    initialize: function (element, options, tangle, variable) {
        this.initialized = false;
    },

    realInitialize: function(element, arrayValues, arrayIdx) {
        this.initialized = true;
        this.$element = $(element);
        this.idx = arrayIdx;
        this.array = arrayValues;

        for (var [i, cellVal] of this.array.entries()) {
            var $new_cell = $('<div class="array-cell-vis">' + cellVal + '</div>');
            if (i == this.idx) {
                $new_cell.addClass('array-cell-vis-active');
            }
            this.$element.append($new_cell);
        }
        this.$element.isotope({
            layoutMode: 'horiz',
            itemSelector: '.' + this.cellClass
        });
    },
  
    update: function (element, value) {
        if (this.initialized) {
            var idx = value.idx;
            if (idx != this.idx) {
                this.$element.children('.' + this.activeCellClass).removeClass(this.activeCellClass);
                this.$element.children()[idx].addClass(this.activeCellClass);
                this.idx = idx;
            }
        } else {
            this.realInitialize(element, value.array, value.idx);
        }
        console.log("TKArrayVis.update()");
    }
};

$(document).ready(function() {
    console.log("UWOTM8");
    var rootElement = document.getElementById('exampleArrayTangle');
    var model = {
        initialize: function () {
            this.exampleArrayIdx = 0;
            this.exampleArray = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500, 600, 700, 800];
        },
        update: function () {
            this.exampleArrayIdxVal = this.exampleArray[this.exampleArrayIdx];
            this.exampleArrayVis = {
                array: this.exampleArray,
                idx: this.exampleArrayIdx,
            }
        }
    };
    var tangle = new Tangle(rootElement, model);
});
