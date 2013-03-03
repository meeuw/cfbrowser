/**
	Title:			Time
	Version:		1.1
	Rights:			Copyright (c) 2007, Ron Valstar
	Author:			Ron Valstar
	Author Email:	ron@ronvalstar.nl
	Author URI:		http://www.ronvalstar.nl/
	Use of this script (with or without modification) is free for all non-commercial work, as long as this header is kept intact.
	For commercial use please contact me at ron@ronvalstar.nl.
*/
package nl.ronvalstar.utils {

	import flash.text.*;
	import flash.display.*;
	import flash.events.*;
	import flash.utils.getTimer;

	public class Time {
		//
		private static var bInit:Boolean = false;
		//
		private static var mParent:DisplayObjectContainer;
		//
		private static var mLabel:TextField;
		private static var oFrm:TextFormat;
		//
		private static var iOldMs:Number;
		private static var fDeltaT:Number;
		//
		private static var bShow:Boolean;
		//
		///////////
		// init //
		public static function init(oDisplay:DisplayObjectContainer):void {
			if (!bInit) {
				mParent = oDisplay;
				mParent.addEventListener( Event.ENTER_FRAME, run);
				//
				mLabel = new TextField();
				mLabel.text = "fps: ";
				mLabel.selectable = false;
				mLabel.background = true;
				mLabel.backgroundColor = 0x800000;
				mLabel.y = 15;
				mLabel.height = 17;
				mLabel.width = 40;
				oFrm = new TextFormat();
				oFrm.font = "Verdana";
				oFrm.color = 0xffffff;
				oFrm.bold = true;
				oFrm.size = 9;
				mLabel.setTextFormat(oFrm);
				bShow = false;
				//
				bInit = true;
			}
		}
		//
		//////////
		// run //
		public static function run(e:Event=null):void {
			var iDeltaTms:Number = getTimer() - Time.iOldMs;
			iOldMs = getTimer();
			fDeltaT = iDeltaTms/1000.0;
			if (bShow) {
				mLabel.text = "fps: "+String(Math.round(1/fDeltaT));
				mLabel.setTextFormat(oFrm);
			}
		}
		//
		////////////////
		// getDeltaT //
		public static function get deltaT():Number {
			return fDeltaT?fDeltaT:1;
		}
		//
		///////////////
		// fpsCount //
		public static function fpsCount(bSet:Boolean=false,iBg:uint=0x800000):void {
			mLabel.backgroundColor = iBg;
			if (bSet!=bShow) {
				if (bSet!=bShow)	mParent.addChild(mLabel);
				else				mParent.removeChild(mLabel);
				bShow = bSet;
			}
		}
	}
}