sap.ui.define([], function () {
    "use strict";

    var CURRENT_YEAR = new Date().getFullYear().toString();
    var YEAR_FIELDS = ["Geschaeftsjahr", "JahrKassenwirksamkeit"];

    return {
        modifyStartupExtension: function (oSelectionVariant) {
            YEAR_FIELDS.forEach(function (sField) {
                var aOptions = oSelectionVariant.getSelectOption(sField);
                if (!aOptions || aOptions.length === 0) {
                    oSelectionVariant.addSelectOption(sField, "I", "EQ", CURRENT_YEAR);
                }
            });
            return Promise.resolve();
        }
    };
});
