package com.videodock.ott;

import com.getcapacitor.BridgeActivity;
import com.google.android.exoplayer2.DefaultLoadControl;

public class MainActivity extends BridgeActivity {

    @Override
    protected void load() {
        super.load();

        new DefaultLoadControl.Builder().createDefaultLoadControl();
    }
}
