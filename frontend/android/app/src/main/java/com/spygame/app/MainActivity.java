package com.spygame.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.spygame.covertops.GameEngine;
import com.spygame.covertops.plugin.CovertOpsPlugin;
import com.spygame.covertops.service.FirebaseTelemetryService;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CovertOpsPlugin.class);
        super.onCreate(savedInstanceState);
        GameEngine.INSTANCE.init(getApplicationContext());
        FirebaseTelemetryService.INSTANCE.init(getApplicationContext());
        FirebaseTelemetryService.INSTANCE.logAppLaunch(getApplicationContext(), GameEngine.INSTANCE.getDatabase(), "operator");
    }
}
