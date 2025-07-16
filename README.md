funny 3d library

# usage

## making shapes
you make shapes by using the following function: `webthreedee.createShape({shape}, {CFrame, eg. cframe: CFrame.create(vector(1, 1, 1), vector(0, 0, 0)}), material)`
## materials
materials use the materialService. an example of a red shiny material would be: material: webthreedee.materialService.CreateMat([1, 0, 0], {shininess: 0.5, mirror: false})
to access material service you use `webthreedee.materialService`. create materials using `CreateMat()`, and fill in the parameters in the following syntax example:
`CreateMat([{clr (array)}], {
	shininess: {shininess},
 	mirror: {mirror (boolean)}
})`
## examples
make a blue sphere:
 `const sphere = webthreedee.createShape('ellipsoid', {
   cframe: CFrame.create(
	 		vector(2, 0, 0),
			vector(0, 0, 0)
    ),
    material: webthreedee.materialService.CreateMat([0, 0, 1], {
      shininess:0,
      mirror: false
    })
  });`
## valid shapes
 the valid shapes within this library are:
 `'ellipsoid', 'wedge', 'cylinder', and 'cuboid'`
 scaling an ellipsoid will always result in a perfect sphere, so ovals are not possible
