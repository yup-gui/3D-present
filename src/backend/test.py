from opcua import Client

client = Client("opc.tcp://192.168.0.1:4840")
client.connect()

root = client.get_root_node()
print("Root node is: ", root)

# PLC = client.get_node("ns=3;s=PLC")
# print("PLC node is: ", PLC,"   ",PLC.get_browse_name())

# for i in PLC.get_children():
#     print("Child node: ",i,"  ",i.get_browse_name())
#     for j in i.get_children():
#         print("subChild node: ",j,"  ",j.get_browse_name())

axis1_pos = client.get_node("ns=4;i=97")

print("Axis1 Position: ", axis1_pos.get_value())

client.disconnect()