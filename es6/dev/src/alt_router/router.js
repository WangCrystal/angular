import { provide, ReflectiveInjector } from 'angular2/core';
import { isBlank, isPresent } from 'angular2/src/facade/lang';
import { ListWrapper } from 'angular2/src/facade/collection';
import { EventEmitter, PromiseWrapper } from 'angular2/src/facade/async';
import { StringMapWrapper } from 'angular2/src/facade/collection';
import { BaseException } from 'angular2/src/facade/exceptions';
import { recognize } from './recognize';
import { link } from './link';
import { equalSegments, routeSegmentComponentFactory, RouteSegment, rootNode } from './segments';
import { hasLifecycleHook } from './lifecycle_reflector';
import { DEFAULT_OUTLET_NAME } from './constants';
export class RouterOutletMap {
    constructor() {
        /** @internal */
        this._outlets = {};
    }
    registerOutlet(name, outlet) { this._outlets[name] = outlet; }
}
export class Router {
    constructor(_rootComponent, _rootComponentType, _componentResolver, _urlSerializer, _routerOutletMap, _location) {
        this._rootComponent = _rootComponent;
        this._rootComponentType = _rootComponentType;
        this._componentResolver = _componentResolver;
        this._urlSerializer = _urlSerializer;
        this._routerOutletMap = _routerOutletMap;
        this._location = _location;
        this._changes = new EventEmitter();
        this.navigateByUrl(this._location.path());
    }
    get urlTree() { return this._urlTree; }
    navigateByUrl(url) {
        return this._navigate(this._urlSerializer.parse(url));
    }
    navigate(changes, segment) {
        return this._navigate(this.createUrlTree(changes, segment));
    }
    _navigate(url) {
        this._urlTree = url;
        return recognize(this._componentResolver, this._rootComponentType, url)
            .then(currTree => {
            return new _LoadSegments(currTree, this._prevTree)
                .load(this._routerOutletMap, this._rootComponent)
                .then(updated => {
                if (updated) {
                    this._prevTree = currTree;
                    this._location.go(this._urlSerializer.serialize(this._urlTree));
                    this._changes.emit(null);
                }
            });
        });
    }
    createUrlTree(changes, segment) {
        if (isPresent(this._prevTree)) {
            let s = isPresent(segment) ? segment : this._prevTree.root;
            return link(s, this._prevTree, this.urlTree, changes);
        }
        else {
            return null;
        }
    }
    serializeUrl(url) { return this._urlSerializer.serialize(url); }
    get changes() { return this._changes; }
    get routeTree() { return this._prevTree; }
}
class _LoadSegments {
    constructor(currTree, prevTree) {
        this.currTree = currTree;
        this.prevTree = prevTree;
        this.deactivations = [];
        this.performMutation = true;
    }
    load(parentOutletMap, rootComponent) {
        let prevRoot = isPresent(this.prevTree) ? rootNode(this.prevTree) : null;
        let currRoot = rootNode(this.currTree);
        return this.canDeactivate(currRoot, prevRoot, parentOutletMap, rootComponent)
            .then(res => {
            this.performMutation = true;
            if (res) {
                this.loadChildSegments(currRoot, prevRoot, parentOutletMap, [rootComponent]);
            }
            return res;
        });
    }
    canDeactivate(currRoot, prevRoot, outletMap, rootComponent) {
        this.performMutation = false;
        this.loadChildSegments(currRoot, prevRoot, outletMap, [rootComponent]);
        let allPaths = PromiseWrapper.all(this.deactivations.map(r => this.checkCanDeactivatePath(r)));
        return allPaths.then((values) => values.filter(v => v).length === values.length);
    }
    checkCanDeactivatePath(path) {
        let curr = PromiseWrapper.resolve(true);
        for (let p of ListWrapper.reversed(path)) {
            curr = curr.then(_ => {
                if (hasLifecycleHook("routerCanDeactivate", p)) {
                    return p.routerCanDeactivate(this.prevTree, this.currTree);
                }
                else {
                    return _;
                }
            });
        }
        return curr;
    }
    loadChildSegments(currNode, prevNode, outletMap, components) {
        let prevChildren = isPresent(prevNode) ?
            prevNode.children.reduce((m, c) => {
                m[c.value.outlet] = c;
                return m;
            }, {}) :
            {};
        currNode.children.forEach(c => {
            this.loadSegments(c, prevChildren[c.value.outlet], outletMap, components);
            StringMapWrapper.delete(prevChildren, c.value.outlet);
        });
        StringMapWrapper.forEach(prevChildren, (v, k) => this.unloadOutlet(outletMap._outlets[k], components));
    }
    loadSegments(currNode, prevNode, parentOutletMap, components) {
        let curr = currNode.value;
        let prev = isPresent(prevNode) ? prevNode.value : null;
        let outlet = this.getOutlet(parentOutletMap, currNode.value);
        if (equalSegments(curr, prev)) {
            this.loadChildSegments(currNode, prevNode, outlet.outletMap, components.concat([outlet.loadedComponent]));
        }
        else {
            this.unloadOutlet(outlet, components);
            if (this.performMutation) {
                let outletMap = new RouterOutletMap();
                let loadedComponent = this.loadNewSegment(outletMap, curr, prev, outlet);
                this.loadChildSegments(currNode, prevNode, outletMap, components.concat([loadedComponent]));
            }
        }
    }
    loadNewSegment(outletMap, curr, prev, outlet) {
        let resolved = ReflectiveInjector.resolve([provide(RouterOutletMap, { useValue: outletMap }), provide(RouteSegment, { useValue: curr })]);
        let ref = outlet.load(routeSegmentComponentFactory(curr), resolved, outletMap);
        if (hasLifecycleHook("routerOnActivate", ref.instance)) {
            ref.instance.routerOnActivate(curr, prev, this.currTree, this.prevTree);
        }
        return ref.instance;
    }
    getOutlet(outletMap, segment) {
        let outlet = outletMap._outlets[segment.outlet];
        if (isBlank(outlet)) {
            if (segment.outlet == DEFAULT_OUTLET_NAME) {
                throw new BaseException(`Cannot find default outlet`);
            }
            else {
                throw new BaseException(`Cannot find the outlet ${segment.outlet}`);
            }
        }
        return outlet;
    }
    unloadOutlet(outlet, components) {
        if (isPresent(outlet) && outlet.isLoaded) {
            StringMapWrapper.forEach(outlet.outletMap._outlets, (v, k) => this.unloadOutlet(v, components));
            if (this.performMutation) {
                outlet.unload();
            }
            else {
                this.deactivations.push(components.concat([outlet.loadedComponent]));
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlmZmluZ19wbHVnaW5fd3JhcHBlci1vdXRwdXRfcGF0aC1VS3ZHUW00MC50bXAvYW5ndWxhcjIvc3JjL2FsdF9yb3V0ZXIvcm91dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJPQUFPLEVBQVMsT0FBTyxFQUFFLGtCQUFrQixFQUFvQixNQUFNLGVBQWU7T0FFN0UsRUFBTyxPQUFPLEVBQUUsU0FBUyxFQUFDLE1BQU0sMEJBQTBCO09BQzFELEVBQUMsV0FBVyxFQUFDLE1BQU0sZ0NBQWdDO09BQ25ELEVBQUMsWUFBWSxFQUFjLGNBQWMsRUFBQyxNQUFNLDJCQUEyQjtPQUMzRSxFQUFDLGdCQUFnQixFQUFDLE1BQU0sZ0NBQWdDO09BQ3hELEVBQUMsYUFBYSxFQUFDLE1BQU0sZ0NBQWdDO09BR3JELEVBQUMsU0FBUyxFQUFDLE1BQU0sYUFBYTtPQUU5QixFQUFDLElBQUksRUFBQyxNQUFNLFFBQVE7T0FFcEIsRUFDTCxhQUFhLEVBQ2IsNEJBQTRCLEVBQzVCLFlBQVksRUFFWixRQUFRLEVBSVQsTUFBTSxZQUFZO09BQ1osRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLHVCQUF1QjtPQUMvQyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sYUFBYTtBQUUvQztJQUFBO1FBQ0UsZ0JBQWdCO1FBQ2hCLGFBQVEsR0FBbUMsRUFBRSxDQUFDO0lBRWhELENBQUM7SUFEQyxjQUFjLENBQUMsSUFBWSxFQUFFLE1BQW9CLElBQVUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzVGLENBQUM7QUFFRDtJQU1FLFlBQW9CLGNBQXNCLEVBQVUsa0JBQXdCLEVBQ3hELGtCQUFxQyxFQUNyQyxjQUFtQyxFQUNuQyxnQkFBaUMsRUFBVSxTQUFtQjtRQUg5RCxtQkFBYyxHQUFkLGNBQWMsQ0FBUTtRQUFVLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBTTtRQUN4RCx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQW1CO1FBQ3JDLG1CQUFjLEdBQWQsY0FBYyxDQUFxQjtRQUNuQyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWlCO1FBQVUsY0FBUyxHQUFULFNBQVMsQ0FBVTtRQUwxRSxhQUFRLEdBQXVCLElBQUksWUFBWSxFQUFRLENBQUM7UUFNOUQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELElBQUksT0FBTyxLQUF1QixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFFekQsYUFBYSxDQUFDLEdBQVc7UUFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQsUUFBUSxDQUFDLE9BQWMsRUFBRSxPQUFzQjtRQUM3QyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFTyxTQUFTLENBQUMsR0FBcUI7UUFDckMsSUFBSSxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUM7UUFDcEIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQzthQUNsRSxJQUFJLENBQUMsUUFBUTtZQUNaLE1BQU0sQ0FBQyxJQUFJLGFBQWEsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztpQkFDN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDO2lCQUNoRCxJQUFJLENBQUMsT0FBTztnQkFDWCxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNaLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO29CQUMxQixJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDaEUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNULENBQUMsQ0FBQyxDQUFDO0lBQ1QsQ0FBQztJQUVELGFBQWEsQ0FBQyxPQUFjLEVBQUUsT0FBc0I7UUFDbEQsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztZQUMzRCxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sTUFBTSxDQUFDLElBQUksQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQsWUFBWSxDQUFDLEdBQXFCLElBQVksTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUxRixJQUFJLE9BQU8sS0FBdUIsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBRXpELElBQUksU0FBUyxLQUF5QixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDaEUsQ0FBQztBQUdEO0lBSUUsWUFBb0IsUUFBNEIsRUFBVSxRQUE0QjtRQUFsRSxhQUFRLEdBQVIsUUFBUSxDQUFvQjtRQUFVLGFBQVEsR0FBUixRQUFRLENBQW9CO1FBSDlFLGtCQUFhLEdBQWUsRUFBRSxDQUFDO1FBQy9CLG9CQUFlLEdBQVksSUFBSSxDQUFDO0lBRWlELENBQUM7SUFFMUYsSUFBSSxDQUFDLGVBQWdDLEVBQUUsYUFBcUI7UUFDMUQsSUFBSSxRQUFRLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN6RSxJQUFJLFFBQVEsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXZDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLGFBQWEsQ0FBQzthQUN4RSxJQUFJLENBQUMsR0FBRztZQUNQLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO1lBQzVCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztZQUMvRSxDQUFDO1lBQ0QsTUFBTSxDQUFDLEdBQUcsQ0FBQztRQUNiLENBQUMsQ0FBQyxDQUFDO0lBQ1QsQ0FBQztJQUVPLGFBQWEsQ0FBQyxRQUFnQyxFQUFFLFFBQWdDLEVBQ2xFLFNBQTBCLEVBQUUsYUFBcUI7UUFDckUsSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7UUFDN0IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUV2RSxJQUFJLFFBQVEsR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9GLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBaUIsS0FBSyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlGLENBQUM7SUFFTyxzQkFBc0IsQ0FBQyxJQUFjO1FBQzNDLElBQUksSUFBSSxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDaEIsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUMvQyxNQUFNLENBQWlCLENBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDOUUsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNYLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVPLGlCQUFpQixDQUFDLFFBQWdDLEVBQUUsUUFBZ0MsRUFDbEUsU0FBMEIsRUFBRSxVQUFvQjtRQUN4RSxJQUFJLFlBQVksR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ2YsUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQ3BCLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ0gsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ1gsQ0FBQyxFQUNELEVBQUUsQ0FBQztZQUNQLEVBQUUsQ0FBQztRQUUxQixRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUMxRSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEQsQ0FBQyxDQUFDLENBQUM7UUFFSCxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUNaLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBRUQsWUFBWSxDQUFDLFFBQWdDLEVBQUUsUUFBZ0MsRUFDbEUsZUFBZ0MsRUFBRSxVQUFvQjtRQUNqRSxJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDO1FBQzFCLElBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztRQUN2RCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFN0QsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFDcEMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEUsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDdEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pCLElBQUksU0FBUyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7Z0JBQ3RDLElBQUksZUFBZSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3pFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzlGLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVPLGNBQWMsQ0FBQyxTQUEwQixFQUFFLElBQWtCLEVBQUUsSUFBa0IsRUFDbEUsTUFBb0I7UUFDekMsSUFBSSxRQUFRLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUNyQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsRUFBQyxRQUFRLEVBQUUsU0FBUyxFQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsWUFBWSxFQUFFLEVBQUMsUUFBUSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hHLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQy9FLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkQsR0FBRyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFFLENBQUM7UUFDRCxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztJQUN0QixDQUFDO0lBRU8sU0FBUyxDQUFDLFNBQTBCLEVBQUUsT0FBcUI7UUFDakUsSUFBSSxNQUFNLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEQsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLG1CQUFtQixDQUFDLENBQUMsQ0FBQztnQkFDMUMsTUFBTSxJQUFJLGFBQWEsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1lBQ3hELENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLElBQUksYUFBYSxDQUFDLDBCQUEwQixPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUN0RSxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVPLFlBQVksQ0FBQyxNQUFvQixFQUFFLFVBQW9CO1FBQzdELEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUN6QyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQ3pCLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ3JFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7T25Jbml0LCBwcm92aWRlLCBSZWZsZWN0aXZlSW5qZWN0b3IsIENvbXBvbmVudFJlc29sdmVyfSBmcm9tICdhbmd1bGFyMi9jb3JlJztcbmltcG9ydCB7Um91dGVyT3V0bGV0fSBmcm9tICcuL2RpcmVjdGl2ZXMvcm91dGVyX291dGxldCc7XG5pbXBvcnQge1R5cGUsIGlzQmxhbmssIGlzUHJlc2VudH0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9sYW5nJztcbmltcG9ydCB7TGlzdFdyYXBwZXJ9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvY29sbGVjdGlvbic7XG5pbXBvcnQge0V2ZW50RW1pdHRlciwgT2JzZXJ2YWJsZSwgUHJvbWlzZVdyYXBwZXJ9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvYXN5bmMnO1xuaW1wb3J0IHtTdHJpbmdNYXBXcmFwcGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2NvbGxlY3Rpb24nO1xuaW1wb3J0IHtCYXNlRXhjZXB0aW9ufSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2V4Y2VwdGlvbnMnO1xuaW1wb3J0IHtSb3V0ZXJVcmxTZXJpYWxpemVyfSBmcm9tICcuL3JvdXRlcl91cmxfc2VyaWFsaXplcic7XG5pbXBvcnQge0NhbkRlYWN0aXZhdGV9IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5pbXBvcnQge3JlY29nbml6ZX0gZnJvbSAnLi9yZWNvZ25pemUnO1xuaW1wb3J0IHtMb2NhdGlvbn0gZnJvbSAnYW5ndWxhcjIvcGxhdGZvcm0vY29tbW9uJztcbmltcG9ydCB7bGlua30gZnJvbSAnLi9saW5rJztcblxuaW1wb3J0IHtcbiAgZXF1YWxTZWdtZW50cyxcbiAgcm91dGVTZWdtZW50Q29tcG9uZW50RmFjdG9yeSxcbiAgUm91dGVTZWdtZW50LFxuICBUcmVlLFxuICByb290Tm9kZSxcbiAgVHJlZU5vZGUsXG4gIFVybFNlZ21lbnQsXG4gIHNlcmlhbGl6ZVJvdXRlU2VnbWVudFRyZWVcbn0gZnJvbSAnLi9zZWdtZW50cyc7XG5pbXBvcnQge2hhc0xpZmVjeWNsZUhvb2t9IGZyb20gJy4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0RFRkFVTFRfT1VUTEVUX05BTUV9IGZyb20gJy4vY29uc3RhbnRzJztcblxuZXhwb3J0IGNsYXNzIFJvdXRlck91dGxldE1hcCB7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX291dGxldHM6IHtbbmFtZTogc3RyaW5nXTogUm91dGVyT3V0bGV0fSA9IHt9O1xuICByZWdpc3Rlck91dGxldChuYW1lOiBzdHJpbmcsIG91dGxldDogUm91dGVyT3V0bGV0KTogdm9pZCB7IHRoaXMuX291dGxldHNbbmFtZV0gPSBvdXRsZXQ7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFJvdXRlciB7XG4gIHByaXZhdGUgX3ByZXZUcmVlOiBUcmVlPFJvdXRlU2VnbWVudD47XG4gIHByaXZhdGUgX3VybFRyZWU6IFRyZWU8VXJsU2VnbWVudD47XG5cbiAgcHJpdmF0ZSBfY2hhbmdlczogRXZlbnRFbWl0dGVyPHZvaWQ+ID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX3Jvb3RDb21wb25lbnQ6IE9iamVjdCwgcHJpdmF0ZSBfcm9vdENvbXBvbmVudFR5cGU6IFR5cGUsXG4gICAgICAgICAgICAgIHByaXZhdGUgX2NvbXBvbmVudFJlc29sdmVyOiBDb21wb25lbnRSZXNvbHZlcixcbiAgICAgICAgICAgICAgcHJpdmF0ZSBfdXJsU2VyaWFsaXplcjogUm91dGVyVXJsU2VyaWFsaXplcixcbiAgICAgICAgICAgICAgcHJpdmF0ZSBfcm91dGVyT3V0bGV0TWFwOiBSb3V0ZXJPdXRsZXRNYXAsIHByaXZhdGUgX2xvY2F0aW9uOiBMb2NhdGlvbikge1xuICAgIHRoaXMubmF2aWdhdGVCeVVybCh0aGlzLl9sb2NhdGlvbi5wYXRoKCkpO1xuICB9XG5cbiAgZ2V0IHVybFRyZWUoKTogVHJlZTxVcmxTZWdtZW50PiB7IHJldHVybiB0aGlzLl91cmxUcmVlOyB9XG5cbiAgbmF2aWdhdGVCeVVybCh1cmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLl9uYXZpZ2F0ZSh0aGlzLl91cmxTZXJpYWxpemVyLnBhcnNlKHVybCkpO1xuICB9XG5cbiAgbmF2aWdhdGUoY2hhbmdlczogYW55W10sIHNlZ21lbnQ/OiBSb3V0ZVNlZ21lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5fbmF2aWdhdGUodGhpcy5jcmVhdGVVcmxUcmVlKGNoYW5nZXMsIHNlZ21lbnQpKTtcbiAgfVxuXG4gIHByaXZhdGUgX25hdmlnYXRlKHVybDogVHJlZTxVcmxTZWdtZW50Pik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuX3VybFRyZWUgPSB1cmw7XG4gICAgcmV0dXJuIHJlY29nbml6ZSh0aGlzLl9jb21wb25lbnRSZXNvbHZlciwgdGhpcy5fcm9vdENvbXBvbmVudFR5cGUsIHVybClcbiAgICAgICAgLnRoZW4oY3VyclRyZWUgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgX0xvYWRTZWdtZW50cyhjdXJyVHJlZSwgdGhpcy5fcHJldlRyZWUpXG4gICAgICAgICAgICAgIC5sb2FkKHRoaXMuX3JvdXRlck91dGxldE1hcCwgdGhpcy5fcm9vdENvbXBvbmVudClcbiAgICAgICAgICAgICAgLnRoZW4odXBkYXRlZCA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVwZGF0ZWQpIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuX3ByZXZUcmVlID0gY3VyclRyZWU7XG4gICAgICAgICAgICAgICAgICB0aGlzLl9sb2NhdGlvbi5nbyh0aGlzLl91cmxTZXJpYWxpemVyLnNlcmlhbGl6ZSh0aGlzLl91cmxUcmVlKSk7XG4gICAgICAgICAgICAgICAgICB0aGlzLl9jaGFuZ2VzLmVtaXQobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBjcmVhdGVVcmxUcmVlKGNoYW5nZXM6IGFueVtdLCBzZWdtZW50PzogUm91dGVTZWdtZW50KTogVHJlZTxVcmxTZWdtZW50PiB7XG4gICAgaWYgKGlzUHJlc2VudCh0aGlzLl9wcmV2VHJlZSkpIHtcbiAgICAgIGxldCBzID0gaXNQcmVzZW50KHNlZ21lbnQpID8gc2VnbWVudCA6IHRoaXMuX3ByZXZUcmVlLnJvb3Q7XG4gICAgICByZXR1cm4gbGluayhzLCB0aGlzLl9wcmV2VHJlZSwgdGhpcy51cmxUcmVlLCBjaGFuZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgc2VyaWFsaXplVXJsKHVybDogVHJlZTxVcmxTZWdtZW50Pik6IHN0cmluZyB7IHJldHVybiB0aGlzLl91cmxTZXJpYWxpemVyLnNlcmlhbGl6ZSh1cmwpOyB9XG5cbiAgZ2V0IGNoYW5nZXMoKTogT2JzZXJ2YWJsZTx2b2lkPiB7IHJldHVybiB0aGlzLl9jaGFuZ2VzOyB9XG5cbiAgZ2V0IHJvdXRlVHJlZSgpOiBUcmVlPFJvdXRlU2VnbWVudD4geyByZXR1cm4gdGhpcy5fcHJldlRyZWU7IH1cbn1cblxuXG5jbGFzcyBfTG9hZFNlZ21lbnRzIHtcbiAgcHJpdmF0ZSBkZWFjdGl2YXRpb25zOiBPYmplY3RbXVtdID0gW107XG4gIHByaXZhdGUgcGVyZm9ybU11dGF0aW9uOiBib29sZWFuID0gdHJ1ZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGN1cnJUcmVlOiBUcmVlPFJvdXRlU2VnbWVudD4sIHByaXZhdGUgcHJldlRyZWU6IFRyZWU8Um91dGVTZWdtZW50Pikge31cblxuICBsb2FkKHBhcmVudE91dGxldE1hcDogUm91dGVyT3V0bGV0TWFwLCByb290Q29tcG9uZW50OiBPYmplY3QpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBsZXQgcHJldlJvb3QgPSBpc1ByZXNlbnQodGhpcy5wcmV2VHJlZSkgPyByb290Tm9kZSh0aGlzLnByZXZUcmVlKSA6IG51bGw7XG4gICAgbGV0IGN1cnJSb290ID0gcm9vdE5vZGUodGhpcy5jdXJyVHJlZSk7XG5cbiAgICByZXR1cm4gdGhpcy5jYW5EZWFjdGl2YXRlKGN1cnJSb290LCBwcmV2Um9vdCwgcGFyZW50T3V0bGV0TWFwLCByb290Q29tcG9uZW50KVxuICAgICAgICAudGhlbihyZXMgPT4ge1xuICAgICAgICAgIHRoaXMucGVyZm9ybU11dGF0aW9uID0gdHJ1ZTtcbiAgICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRDaGlsZFNlZ21lbnRzKGN1cnJSb290LCBwcmV2Um9vdCwgcGFyZW50T3V0bGV0TWFwLCBbcm9vdENvbXBvbmVudF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY2FuRGVhY3RpdmF0ZShjdXJyUm9vdDogVHJlZU5vZGU8Um91dGVTZWdtZW50PiwgcHJldlJvb3Q6IFRyZWVOb2RlPFJvdXRlU2VnbWVudD4sXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRsZXRNYXA6IFJvdXRlck91dGxldE1hcCwgcm9vdENvbXBvbmVudDogT2JqZWN0KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdGhpcy5wZXJmb3JtTXV0YXRpb24gPSBmYWxzZTtcbiAgICB0aGlzLmxvYWRDaGlsZFNlZ21lbnRzKGN1cnJSb290LCBwcmV2Um9vdCwgb3V0bGV0TWFwLCBbcm9vdENvbXBvbmVudF0pO1xuXG4gICAgbGV0IGFsbFBhdGhzID0gUHJvbWlzZVdyYXBwZXIuYWxsKHRoaXMuZGVhY3RpdmF0aW9ucy5tYXAociA9PiB0aGlzLmNoZWNrQ2FuRGVhY3RpdmF0ZVBhdGgocikpKTtcbiAgICByZXR1cm4gYWxsUGF0aHMudGhlbigodmFsdWVzOiBib29sZWFuW10pID0+IHZhbHVlcy5maWx0ZXIodiA9PiB2KS5sZW5ndGggPT09IHZhbHVlcy5sZW5ndGgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja0NhbkRlYWN0aXZhdGVQYXRoKHBhdGg6IE9iamVjdFtdKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgbGV0IGN1cnIgPSBQcm9taXNlV3JhcHBlci5yZXNvbHZlKHRydWUpO1xuICAgIGZvciAobGV0IHAgb2YgTGlzdFdyYXBwZXIucmV2ZXJzZWQocGF0aCkpIHtcbiAgICAgIGN1cnIgPSBjdXJyLnRoZW4oXyA9PiB7XG4gICAgICAgIGlmIChoYXNMaWZlY3ljbGVIb29rKFwicm91dGVyQ2FuRGVhY3RpdmF0ZVwiLCBwKSkge1xuICAgICAgICAgIHJldHVybiAoPENhbkRlYWN0aXZhdGU+cCkucm91dGVyQ2FuRGVhY3RpdmF0ZSh0aGlzLnByZXZUcmVlLCB0aGlzLmN1cnJUcmVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gXztcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBjdXJyO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2FkQ2hpbGRTZWdtZW50cyhjdXJyTm9kZTogVHJlZU5vZGU8Um91dGVTZWdtZW50PiwgcHJldk5vZGU6IFRyZWVOb2RlPFJvdXRlU2VnbWVudD4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0bGV0TWFwOiBSb3V0ZXJPdXRsZXRNYXAsIGNvbXBvbmVudHM6IE9iamVjdFtdKTogdm9pZCB7XG4gICAgbGV0IHByZXZDaGlsZHJlbiA9IGlzUHJlc2VudChwcmV2Tm9kZSkgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldk5vZGUuY2hpbGRyZW4ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChtLCBjKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtW2MudmFsdWUub3V0bGV0XSA9IGM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt9KSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICB7fTtcblxuICAgIGN1cnJOb2RlLmNoaWxkcmVuLmZvckVhY2goYyA9PiB7XG4gICAgICB0aGlzLmxvYWRTZWdtZW50cyhjLCBwcmV2Q2hpbGRyZW5bYy52YWx1ZS5vdXRsZXRdLCBvdXRsZXRNYXAsIGNvbXBvbmVudHMpO1xuICAgICAgU3RyaW5nTWFwV3JhcHBlci5kZWxldGUocHJldkNoaWxkcmVuLCBjLnZhbHVlLm91dGxldCk7XG4gICAgfSk7XG5cbiAgICBTdHJpbmdNYXBXcmFwcGVyLmZvckVhY2gocHJldkNoaWxkcmVuLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAodiwgaykgPT4gdGhpcy51bmxvYWRPdXRsZXQob3V0bGV0TWFwLl9vdXRsZXRzW2tdLCBjb21wb25lbnRzKSk7XG4gIH1cblxuICBsb2FkU2VnbWVudHMoY3Vyck5vZGU6IFRyZWVOb2RlPFJvdXRlU2VnbWVudD4sIHByZXZOb2RlOiBUcmVlTm9kZTxSb3V0ZVNlZ21lbnQ+LFxuICAgICAgICAgICAgICAgcGFyZW50T3V0bGV0TWFwOiBSb3V0ZXJPdXRsZXRNYXAsIGNvbXBvbmVudHM6IE9iamVjdFtdKTogdm9pZCB7XG4gICAgbGV0IGN1cnIgPSBjdXJyTm9kZS52YWx1ZTtcbiAgICBsZXQgcHJldiA9IGlzUHJlc2VudChwcmV2Tm9kZSkgPyBwcmV2Tm9kZS52YWx1ZSA6IG51bGw7XG4gICAgbGV0IG91dGxldCA9IHRoaXMuZ2V0T3V0bGV0KHBhcmVudE91dGxldE1hcCwgY3Vyck5vZGUudmFsdWUpO1xuXG4gICAgaWYgKGVxdWFsU2VnbWVudHMoY3VyciwgcHJldikpIHtcbiAgICAgIHRoaXMubG9hZENoaWxkU2VnbWVudHMoY3Vyck5vZGUsIHByZXZOb2RlLCBvdXRsZXQub3V0bGV0TWFwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmNvbmNhdChbb3V0bGV0LmxvYWRlZENvbXBvbmVudF0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51bmxvYWRPdXRsZXQob3V0bGV0LCBjb21wb25lbnRzKTtcbiAgICAgIGlmICh0aGlzLnBlcmZvcm1NdXRhdGlvbikge1xuICAgICAgICBsZXQgb3V0bGV0TWFwID0gbmV3IFJvdXRlck91dGxldE1hcCgpO1xuICAgICAgICBsZXQgbG9hZGVkQ29tcG9uZW50ID0gdGhpcy5sb2FkTmV3U2VnbWVudChvdXRsZXRNYXAsIGN1cnIsIHByZXYsIG91dGxldCk7XG4gICAgICAgIHRoaXMubG9hZENoaWxkU2VnbWVudHMoY3Vyck5vZGUsIHByZXZOb2RlLCBvdXRsZXRNYXAsIGNvbXBvbmVudHMuY29uY2F0KFtsb2FkZWRDb21wb25lbnRdKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBsb2FkTmV3U2VnbWVudChvdXRsZXRNYXA6IFJvdXRlck91dGxldE1hcCwgY3VycjogUm91dGVTZWdtZW50LCBwcmV2OiBSb3V0ZVNlZ21lbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgb3V0bGV0OiBSb3V0ZXJPdXRsZXQpOiBPYmplY3Qge1xuICAgIGxldCByZXNvbHZlZCA9IFJlZmxlY3RpdmVJbmplY3Rvci5yZXNvbHZlKFxuICAgICAgICBbcHJvdmlkZShSb3V0ZXJPdXRsZXRNYXAsIHt1c2VWYWx1ZTogb3V0bGV0TWFwfSksIHByb3ZpZGUoUm91dGVTZWdtZW50LCB7dXNlVmFsdWU6IGN1cnJ9KV0pO1xuICAgIGxldCByZWYgPSBvdXRsZXQubG9hZChyb3V0ZVNlZ21lbnRDb21wb25lbnRGYWN0b3J5KGN1cnIpLCByZXNvbHZlZCwgb3V0bGV0TWFwKTtcbiAgICBpZiAoaGFzTGlmZWN5Y2xlSG9vayhcInJvdXRlck9uQWN0aXZhdGVcIiwgcmVmLmluc3RhbmNlKSkge1xuICAgICAgcmVmLmluc3RhbmNlLnJvdXRlck9uQWN0aXZhdGUoY3VyciwgcHJldiwgdGhpcy5jdXJyVHJlZSwgdGhpcy5wcmV2VHJlZSk7XG4gICAgfVxuICAgIHJldHVybiByZWYuaW5zdGFuY2U7XG4gIH1cblxuICBwcml2YXRlIGdldE91dGxldChvdXRsZXRNYXA6IFJvdXRlck91dGxldE1hcCwgc2VnbWVudDogUm91dGVTZWdtZW50KTogUm91dGVyT3V0bGV0IHtcbiAgICBsZXQgb3V0bGV0ID0gb3V0bGV0TWFwLl9vdXRsZXRzW3NlZ21lbnQub3V0bGV0XTtcbiAgICBpZiAoaXNCbGFuayhvdXRsZXQpKSB7XG4gICAgICBpZiAoc2VnbWVudC5vdXRsZXQgPT0gREVGQVVMVF9PVVRMRVRfTkFNRSkge1xuICAgICAgICB0aHJvdyBuZXcgQmFzZUV4Y2VwdGlvbihgQ2Fubm90IGZpbmQgZGVmYXVsdCBvdXRsZXRgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBCYXNlRXhjZXB0aW9uKGBDYW5ub3QgZmluZCB0aGUgb3V0bGV0ICR7c2VnbWVudC5vdXRsZXR9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvdXRsZXQ7XG4gIH1cblxuICBwcml2YXRlIHVubG9hZE91dGxldChvdXRsZXQ6IFJvdXRlck91dGxldCwgY29tcG9uZW50czogT2JqZWN0W10pOiB2b2lkIHtcbiAgICBpZiAoaXNQcmVzZW50KG91dGxldCkgJiYgb3V0bGV0LmlzTG9hZGVkKSB7XG4gICAgICBTdHJpbmdNYXBXcmFwcGVyLmZvckVhY2gob3V0bGV0Lm91dGxldE1hcC5fb3V0bGV0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAodiwgaykgPT4gdGhpcy51bmxvYWRPdXRsZXQodiwgY29tcG9uZW50cykpO1xuICAgICAgaWYgKHRoaXMucGVyZm9ybU11dGF0aW9uKSB7XG4gICAgICAgIG91dGxldC51bmxvYWQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVhY3RpdmF0aW9ucy5wdXNoKGNvbXBvbmVudHMuY29uY2F0KFtvdXRsZXQubG9hZGVkQ29tcG9uZW50XSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufSJdfQ==