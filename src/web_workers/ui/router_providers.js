'use strict';"use strict";
var platform_location_1 = require('./platform_location');
var browser_platform_location_1 = require('angular2/src/platform/browser/location/browser_platform_location');
var core_1 = require('angular2/core');
exports.WORKER_RENDER_ROUTER = [
    platform_location_1.MessageBasedPlatformLocation,
    browser_platform_location_1.BrowserPlatformLocation,
    /* @ts2dart_Provider */ { provide: core_1.APP_INITIALIZER, useFactory: initRouterListeners, multi: true, deps: [core_1.Injector] }
];
function initRouterListeners(injector) {
    return function () {
        var zone = injector.get(core_1.NgZone);
        zone.runGuarded(function () { return injector.get(platform_location_1.MessageBasedPlatformLocation).start(); });
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyX3Byb3ZpZGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtSVJ0QzFXd0QudG1wL2FuZ3VsYXIyL3NyYy93ZWJfd29ya2Vycy91aS9yb3V0ZXJfcHJvdmlkZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxrQ0FBMkMscUJBQXFCLENBQUMsQ0FBQTtBQUNqRSwwQ0FFTyxrRUFBa0UsQ0FBQyxDQUFBO0FBQzFFLHFCQUEwRCxlQUFlLENBQUMsQ0FBQTtBQUU3RCw0QkFBb0IsR0FBcUI7SUFDcEQsZ0RBQTRCO0lBQzVCLG1EQUF1QjtJQUN2Qix1QkFBdUIsQ0FBQyxFQUFDLE9BQU8sRUFBRSxzQkFBZSxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLGVBQVEsQ0FBQyxFQUFDO0NBQ25ILENBQUM7QUFFRiw2QkFBNkIsUUFBa0I7SUFDN0MsTUFBTSxDQUFDO1FBQ0wsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxhQUFNLENBQUMsQ0FBQztRQUVoQyxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQU0sT0FBQSxRQUFRLENBQUMsR0FBRyxDQUFDLGdEQUE0QixDQUFDLENBQUMsS0FBSyxFQUFFLEVBQWxELENBQWtELENBQUMsQ0FBQztJQUM1RSxDQUFDLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtNZXNzYWdlQmFzZWRQbGF0Zm9ybUxvY2F0aW9ufSBmcm9tICcuL3BsYXRmb3JtX2xvY2F0aW9uJztcbmltcG9ydCB7XG4gIEJyb3dzZXJQbGF0Zm9ybUxvY2F0aW9uXG59IGZyb20gJ2FuZ3VsYXIyL3NyYy9wbGF0Zm9ybS9icm93c2VyL2xvY2F0aW9uL2Jyb3dzZXJfcGxhdGZvcm1fbG9jYXRpb24nO1xuaW1wb3J0IHtBUFBfSU5JVElBTElaRVIsIFByb3ZpZGVyLCBJbmplY3RvciwgTmdab25lfSBmcm9tICdhbmd1bGFyMi9jb3JlJztcblxuZXhwb3J0IGNvbnN0IFdPUktFUl9SRU5ERVJfUk9VVEVSID0gLypAdHMyZGFydF9jb25zdCovW1xuICBNZXNzYWdlQmFzZWRQbGF0Zm9ybUxvY2F0aW9uLFxuICBCcm93c2VyUGxhdGZvcm1Mb2NhdGlvbixcbiAgLyogQHRzMmRhcnRfUHJvdmlkZXIgKi8ge3Byb3ZpZGU6IEFQUF9JTklUSUFMSVpFUiwgdXNlRmFjdG9yeTogaW5pdFJvdXRlckxpc3RlbmVycywgbXVsdGk6IHRydWUsIGRlcHM6IFtJbmplY3Rvcl19XG5dO1xuXG5mdW5jdGlvbiBpbml0Um91dGVyTGlzdGVuZXJzKGluamVjdG9yOiBJbmplY3Rvcik6ICgpID0+IHZvaWQge1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGxldCB6b25lID0gaW5qZWN0b3IuZ2V0KE5nWm9uZSk7XG5cbiAgICB6b25lLnJ1bkd1YXJkZWQoKCkgPT4gaW5qZWN0b3IuZ2V0KE1lc3NhZ2VCYXNlZFBsYXRmb3JtTG9jYXRpb24pLnN0YXJ0KCkpO1xuICB9O1xufVxuIl19