sap.ui.define([], function () {
    "use strict";

    var CURRENT_YEAR = new Date().getFullYear().toString();
    var YEAR_FIELDS = ["Geschaeftsjahr", "JahrKassenwirksamkeit"];

    var oImpl = {
        modifyStartupExtension: function (oSelectionVariant) {
            console.error("OVPEXT modifyStartupExtension CALLED year=" + CURRENT_YEAR);
            YEAR_FIELDS.forEach(function (sField) {
                var aOptions = oSelectionVariant.getSelectOption(sField);
                if (!aOptions || aOptions.length === 0) {
                    oSelectionVariant.addSelectOption(sField, "I", "EQ", CURRENT_YEAR);
                    console.error("OVPEXT added " + sField);
                }
            });
            return Promise.resolve();
        }
    };

    console.error("OVPEXT registering controller extension");
    sap.ui.controller(
        "lbd.hasta.opexample.opexample.ext.controller.OverviewPageExt",
        oImpl
    );
    console.error("OVPEXT controller extension registered");

    return oImpl;
});
