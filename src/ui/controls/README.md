# Controls — TV4

controlBindings.ts render và bind controls với LabConfig, preset và Canvas2D preview. Module chỉ phát thay đổi config qua callback; không import engine.

Khi tích hợp, TV1 nối callback updateConfig sang engine port ở composition root. TV2/TV3 cần xác nhận ranges/mode trước khi coi LabConfig là contract chung.
