import { Vec3 } from "../lib/TSM";
import { Camera } from "../lib/webglutils/Camera";


// Creates a two dimensional rectangular portal
export class Portal{

    private position: Vec3; // center of the portal in world space
    private normal: Vec3; // normal of face of portal, determines orientation
    private width: number; // width of portal
    private height: number; // height of portal
    private outlet: Portal | null; // the portal that this portal leads to
    private blocks: Vec3[]; // Coordinates of blocks that are part of the portal

    
    constructor(position: Vec3, normal: Vec3, width: number, height: number){
        this.position = position;
        this.normal= normal;
        this.width = width;
        this.height = height;
        this.outlet = null;
        this.blocks = [];
    }

    public getPortalTeleportPosition(): Vec3{
        return this.outlet? this.outlet.position: this.position;
    }

    // Given position of player, find distance to portal
    public distanceTo(position: Vec3): number{
        return 0;

    }
    // Given position of player, is player inside portal?
    public intersects(position: Vec3): boolean{
        return true;
    }

    // Uses floodfill to determine if a block is part of the portal
    public addBlockIfPartOfPortal(position: Vec3): boolean{
        // Top
        // Bottom
        // Left
        // Right
        return true;
    }


    // Given camera of player, calculate what the camera should be on the other side of the portal
    public getCameraInfo(camera:Camera): Camera{
        return camera;
    }

}

// 2D mesh for portal
export class PortalMesh{
    public center: Vec3;
    private positionsF32: Float32Array;
    private indicesU32: Uint32Array;
    private normalF32: Float32Array;
    private uvF32: Float32Array;

    // We assume a 1x1 square centered at the origin
    constructor(center: Vec3){
        
    }
}